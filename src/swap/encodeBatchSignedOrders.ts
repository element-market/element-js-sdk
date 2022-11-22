import { BigNumber, ethers } from 'ethers'
import { ETH_TOKEN_ADDRESS, NULL_ADDRESS } from '../types/types'
import { ContractABI } from '../contracts/abi'
import {
    BatchSignedERC721OrderParameters,
    BatchSignedERC721OrderRequest,
    BatchSignedERC721OrderResponse,
    CollectionsBytesList
} from '../element/batchSignedOrder/batchSignedTypes'
import { encodeBits } from '../util/bitsUtil'
import { TradeDetails } from './swapTypes'

const MASK_96 = '0xffffffffffffffffffffffff'

const elementExV3 = new ethers.Contract(NULL_ADDRESS, ContractABI.elementEx.abi)

export async function encodeBatchSignedOrders(orders: BatchSignedERC721OrderResponse[], taker: string, marketId: string | number): Promise<TradeDetails | null> {
    if (orders == null || orders.length == 0) {
        return null
    }
    
    const ordersClassifyByHash: BatchSignedERC721OrderResponse[][] = []
    for (const order of orders) {
        let i = 0
        while (i < ordersClassifyByHash.length && ordersClassifyByHash[i][0].hash != order.hash) {
            i++
        }
        if (i == ordersClassifyByHash.length) {
            ordersClassifyByHash.push([order])
        } else {
            ordersClassifyByHash[i].push(order)
        }
    }
    
    let value = BigNumber.from(0)
    const royaltyFeeStat: Map<string, number> = new Map<string, number>()
    
    const parameters: BatchSignedERC721OrderParameters[] = []
    for (const orders of ordersClassifyByHash) {
        const r = toFilledParameters(orders, taker)
        if (r != null) {
            value = value.add(r.value)
            r.royaltyFeeStat.forEach((value, key, map) => {
                const currentValue = royaltyFeeStat.get(key)
                royaltyFeeStat.set(key, currentValue ? (value + currentValue) : value)
            })
            parameters.push(...r.parameters)
        }
    }
    
    if (parameters.length == 0) {
        return null
    } else if (parameters.length == 1) {
        const data = await elementExV3.populateTransaction.fillBatchSignedERC721Order(parameters[0], parameters[0].collections)
        return {
            marketId: marketId,
            value: value.toString(),
            data: data.data as any
        }
    } else {
        /// @param additional1 [96 bits(withdrawETHAmount) + 160 bits(erc20Token)]
        const additional1 = encodeBits([
            [0, 96],
            [ETH_TOKEN_ADDRESS, 160]
        ])
        
        /// @param additional2 [8 bits(revertIfIncomplete) + 88 bits(unused) + 160 bits(royaltyFeeRecipient)]
        let royaltyFeeRecipient = NULL_ADDRESS
        let times = 0
        royaltyFeeStat.forEach((value, key, map) => {
            if (value > times) {
                times = value
                royaltyFeeRecipient = key
            }
        })
        const additional2 = encodeBits([
            [0, 8],
            [0, 88],
            [royaltyFeeRecipient, 160]
        ])
    
        const data = await elementExV3.populateTransaction.fillBatchSignedERC721Orders(parameters, additional1, additional2)
        return {
            marketId: marketId,
            value: value.toString(),
            data: data.data as any
        }
    }
}

interface FilledParameters {
    value: string;
    royaltyFeeStat: Map<string, number>;
    parameters: BatchSignedERC721OrderParameters[];
}

function toFilledParameters(orders: BatchSignedERC721OrderResponse[], taker: string): FilledParameters | null {
    const takerPart1 = BigNumber.from(taker).shr(96).toHexString()
    const takerPart2 = BigNumber.from(taker).and(MASK_96).toHexString()
    
    const order0 = orders[0]
    
    /// @param data1 [56 bits(startNonce) + 8 bits(v) + 32 bits(listingTime) + 160 bits(maker)]
    const data1 = encodeBits([
        [order0.startNonce, 56],
        [order0.v, 8],
        [order0.listingTime, 32],
        [order0.maker, 160]
    ])
    
    /// @param data2 [64 bits(taker part1) + 32 bits(expiryTime) + 160 bits(erc20Token)]
    const data2 = encodeBits([
        [takerPart1, 64],
        [order0.expirationTime, 32],
        [ETH_TOKEN_ADDRESS, 160]
    ])
    
    /// @param data3 [96 bits(taker part2) + 160 bits(platformFeeRecipient)]
    const data3 = encodeBits([
        [takerPart2, 96],
        [order0.platformFeeRecipient, 160]
    ])
    
    const nonces: number[] = []
    for (const order of orders) {
        nonces.push(order.nonce)
    }
    
    const bytesList = toCollectionsBytesList(order0, nonces)
    if (bytesList != null) {
        const parameters: BatchSignedERC721OrderParameters[] = []
        for (const bytes of bytesList.bytesList) {
            parameters.push({
                data1: data1,
                data2: data2,
                data3: data3,
                r: encodeBits([[order0.r, 256]]),
                s: encodeBits([[order0.s, 256]]),
                collections: bytes
            })
        }
        return {
            value: bytesList.value,
            royaltyFeeStat: bytesList.royaltyFeeStat,
            parameters: parameters
        }
    } else {
        return null
    }
}

export function toCollectionsBytesList(order: BatchSignedERC721OrderRequest, nonceList: number[]): CollectionsBytesList | null {
    if (nonceList == null || nonceList.length == 0) {
        return null
    }
    
    const nonceSet = new Set<number>()
    for (const nonce of nonceList) {
        nonceSet.add(nonce)
    }
    const nonces: number[] = [...nonceSet]
    nonces.sort(function(a, b) {
        return a - b
    })
    
    const nonceLimit = order.startNonce + getItemsCount(order)
    if (nonces[nonces.length - 1] >= nonceLimit) {
        throw Error(`The BatchSignedERC721Order(orderHash=${order.hash}) is invalid, nonce=${nonces[nonces.length - 1]}, nonceLimit=${nonceLimit}.`)
    }
    
    let value = BigNumber.from(0)
    const royaltyFeeStat: Map<string, number> = new Map<string, number>()
    const bytesList: string[] = []
    
    const filledNonceSet = new Set<number>()
    while (filledNonceSet.size < nonces.length) {
        const unfilledNonceList: number[] = []
        for (const nonce of nonces) {
            if (!filledNonceSet.has(nonce)) {
                unfilledNonceList.push(nonce)
            }
        }
        
        const r = toCollectionsBytes(order, unfilledNonceList)
        value = value.add(r.value)
        r.royaltyFeeStat.forEach((value, key, map) => {
            const currentValue = royaltyFeeStat.get(key)
            royaltyFeeStat.set(key, currentValue ? (value + currentValue) : value)
        })
        bytesList.push(r.bytes)
        
        for (const filledNonce of r.filledNonceSet) {
            filledNonceSet.add(filledNonce)
        }
    }
    
    return {
        value: value.toString(),
        royaltyFeeStat: royaltyFeeStat,
        bytesList: bytesList
    }
}

interface CollectionsBytes {
    value: BigNumber;
    royaltyFeeStat: Map<string, number>;
    bytes: string;
    filledNonceSet: Set<number>;
}

function toCollectionsBytes(order: BatchSignedERC721OrderRequest, nonces: number[]): CollectionsBytes {
    let bytes = '0x'
    let value = BigNumber.from(0)
    const filledNonceSet: Set<number> = new Set<number>()
    const royaltyFeeStat: Map<string, number> = new Map<string, number>()
    
    let collectionStartNonce = order.startNonce
    let index = 0
    
    if (order.basicCollections != null) {
        for (const basicCollection of order.basicCollections) {
            const itemsCount = basicCollection.items.length
            const startNonce = collectionStartNonce
            const endNonce = startNonce + itemsCount
            collectionStartNonce = endNonce
            
            const filledIndexList: number[] = []
            
            let i = 0
            while (index < nonces.length && nonces[index] >= startNonce && nonces[index] < endNonce) {
                if (i < 16) {
                    filledNonceSet.add(nonces[index])
                    filledIndexList[i] = nonces[index] - startNonce
                    value = value.add(basicCollection.items[filledIndexList[i]].erc20TokenAmount)
                }
                index++
                i++
            }
            
            let filledIndexListPart1 = '0'
            let filledIndexListPart2 = '0'
            if (filledIndexList.length > 0) {
                if (basicCollection.royaltyFeeRecipient != NULL_ADDRESS) {
                    const key = basicCollection.royaltyFeeRecipient.toLowerCase()
                    const currentValue = royaltyFeeStat.get(key)
                    royaltyFeeStat.set(key, currentValue ? (currentValue + 1) : 1)
                }
                
                let filledIndexListHex = ''
                for (let i = 0; i < filledIndexList.length; i++) {
                    const filledIndex = filledIndexList[i]
                    if (filledIndex < 16) {
                        filledIndexListHex = '0' + filledIndex.toString(16) + filledIndexListHex
                    } else {
                        filledIndexListHex = filledIndex.toString(16) + filledIndexListHex
                    }
                }
                for (let i = filledIndexList.length; i < 16; i++) {
                    filledIndexListHex += '00'
                }
                
                filledIndexListPart1 = '0x' + filledIndexListHex.substring(0, 24)
                filledIndexListPart2 = '0x' + filledIndexListHex.substring(24)
            }
            
            // head1 [96 bits(filledIndexList part1) + 160 bits(nftAddress)]
            const head1 = encodeBits([
                [filledIndexListPart1, 96],
                [basicCollection.nftAddress, 160]
            ])
            
            // collectionType: 0 - basicCollection, 1 - collection
            // head2 [8 bits(collectionType) + 8 bits(itemsCount) + 8 bits(filledCount) + 8 bits(unused) + 32 bits(filledIndexList part2)
            //        + 16 bits(platformFeePercentage) + 16 bits(royaltyFeePercentage) + 160 bits(royaltyFeeRecipient)]
            const head2 = encodeBits([
                [0, 8],
                [itemsCount, 8],
                [filledIndexList.length, 8],
                [0, 8],
                [filledIndexListPart2, 32],
                [basicCollection.platformFee, 16],
                [basicCollection.royaltyFee, 16],
                [basicCollection.royaltyFeeRecipient, 160]
            ])
            
            let itemsBytes = '0x'
            for (const item of basicCollection.items) {
                /// @param items [96 bits(erc20TokenAmount) + 160 bits(nftId)].
                const itemBytes = encodeBits([
                    [item.erc20TokenAmount, 96],
                    [item.nftId, 160]
                ])
                itemsBytes += itemBytes.substring(2)
            }
            bytes += head1.substring(2) + head2.substring(2) + itemsBytes.substring(2)
        }
    }
    
    if (order.collections != null) {
        for (const collection of order.collections) {
            const itemsCount = collection.items.length
            const startNonce = collectionStartNonce
            const endNonce = startNonce + itemsCount
            collectionStartNonce = endNonce
            
            const filledIndexList: number[] = []
            
            let i = 0
            while (index < nonces.length && nonces[index] >= startNonce && nonces[index] < endNonce) {
                if (i < 16) {
                    filledNonceSet.add(nonces[index])
                    filledIndexList[i] = nonces[index] - startNonce
                    value = value.add(collection.items[filledIndexList[i]].erc20TokenAmount)
                }
                index++
                i++
            }
            
            let filledIndexListPart1 = '0'
            let filledIndexListPart2 = '0'
            if (filledIndexList.length > 0) {
                if (collection.royaltyFeeRecipient != NULL_ADDRESS) {
                    const key = collection.royaltyFeeRecipient.toLowerCase()
                    const currentValue = royaltyFeeStat.get(key)
                    royaltyFeeStat.set(key, currentValue ? (currentValue + 1) : 1)
                }
                
                let filledIndexListHex = ''
                for (let i = 0; i < filledIndexList.length; i++) {
                    const filledIndex = filledIndexList[i]
                    if (filledIndex < 16) {
                        filledIndexListHex = '0' + filledIndex.toString(16) + filledIndexListHex
                    } else {
                        filledIndexListHex = filledIndex.toString(16) + filledIndexListHex
                    }
                }
                for (let i = filledIndexList.length; i < 16; i++) {
                    filledIndexListHex += '00'
                }
                
                filledIndexListPart1 = '0x' + filledIndexListHex.substring(0, 24)
                filledIndexListPart2 = '0x' + filledIndexListHex.substring(24)
            }
            
            // head1 [96 bits(filledIndexList part1) + 160 bits(nftAddress)]
            const head1 = encodeBits([
                [filledIndexListPart1, 96],
                [collection.nftAddress, 160]
            ])
            
            // collectionType: 0 - collection, 1 - collection
            // head2 [8 bits(collectionType) + 8 bits(itemsCount) + 8 bits(filledCount) + 8 bits(unused) + 32 bits(filledIndexList part2)
            //        + 16 bits(platformFeePercentage) + 16 bits(royaltyFeePercentage) + 160 bits(royaltyFeeRecipient)]
            const head2 = encodeBits([
                [1, 8],
                [itemsCount, 8],
                [filledIndexList.length, 8],
                [0, 8],
                [filledIndexListPart2, 32],
                [collection.platformFee, 16],
                [collection.royaltyFee, 16],
                [collection.royaltyFeeRecipient, 160]
            ])
            
            let itemsBytes = '0x'
            for (const item of collection.items) {
                const itemBytes = encodeBits([[item.erc20TokenAmount, 256]]) + encodeBits([[item.nftId, 256]]).substring(2)
                itemsBytes += itemBytes.substring(2)
            }
            bytes += head1.substring(2) + head2.substring(2) + itemsBytes.substring(2)
        }
    }
    return {
        value: value,
        royaltyFeeStat: royaltyFeeStat,
        bytes: bytes,
        filledNonceSet: filledNonceSet
    }
}

function getItemsCount(order: BatchSignedERC721OrderRequest): number {
    let count = 0
    if (order.basicCollections != null) {
        for (const basicCollection of order.basicCollections) {
            if (basicCollection.items == null || basicCollection.items.length == 0 || basicCollection.items.length > 255) {
                throw Error(`The BatchSignedERC721Order(orderHash=${order.hash}) is invalid.`)
            }
            count += basicCollection.items.length
        }
    }
    
    if (order.collections != null) {
        for (const collection of order.collections) {
            if (collection.items == null || collection.items.length == 0 || collection.items.length > 255) {
                throw Error(`The BatchSignedERC721Order(orderHash=${order.hash}) is invalid.`)
            }
            count += collection.items.length
        }
    }
    return count
}
