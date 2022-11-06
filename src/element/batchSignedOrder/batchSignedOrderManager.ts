import { LimitedCallSpec, Web3Signer } from '../../signer/Web3Signer'
import { getElementExContract, getHelperContract } from '../../contracts/contracts'
import { BigNumber, Contract, ethers } from 'ethers'
import {
    AssetSchema,
    ERC721SellOrderItem,
    GasParams,
    MakeERC721SellOrdersParams,
    NULL_ADDRESS,
    OrderInformation,
    OrderSide,
    SaleKind,
    Standard
} from '../../types/types'
import { DEFAULT_EXPIRATION_TIME, MAX_EXPIRATION_TIME, MAX_LISTING_TIME } from '../order/orderTypes'
import { ApiOption, Fees } from '../../api/openApiTypes'
import { getChain } from '../../util/chainUtil'
import { toStandardERC20Token } from '../../util/tokenUtil'
import {
    BatchSignedERC721Order,
    BatchSignedERC721OrderRequest,
    BatchSignedERC721OrderResponse,
    Collection
} from './batchSignedTypes'
import { getTypedData } from './batchSignedTypedData'
import { fillBatchSignedOrder } from './fillBatchSignedOrder'
import { queryFees, queryNonce } from '../../api/openApi'
import { toString } from '../../util/numberUtil'

export const maxBasicNftId = BigNumber.from('0xffffffffffffffffffffffffffffffffffffffff')
export const maxERC20Amount = BigNumber.from('0xffffffffffffffffffffffffffffffffffffffff')
export const maxBasicERC20Amount = BigNumber.from('0xffffffffffffffffffffffff')

export class BatchSignedOrderManager {

    public web3Signer: Web3Signer
    public apiOption: ApiOption
    public elementEx: Contract
    public helper: Contract

    constructor(web3Signer: Web3Signer, apiOption: ApiOption) {
        this.web3Signer = web3Signer
        this.apiOption = apiOption
        this.elementEx = getElementExContract(web3Signer.chainId)
        this.helper = getHelperContract(web3Signer.chainId)
    }

    public async createOrders(params: MakeERC721SellOrdersParams, counter?: number): Promise<Array<BatchSignedERC721Order>> {
        const fees = await this.queryFees(params)
        const platformFeeRecipient = getPlatformFeeRecipient(fees)
        const chain = getChain(this.web3Signer.chainId)
        const maker = await this.web3Signer.getCurrentAccount()
        const paymentToken = toStandardERC20Token(params.paymentToken)
        const { listingTime, expirationTime } = getOrderTime(params)
        const hashNonce = (counter != null) ? counter : await this.elementEx.getHashNonce(maker)

        const list = getOrders(params.items)
        const orders: BatchSignedERC721Order[] = []

        let error
        for (const order of list) {
            try {
                const nonce = await queryNonce({
                    maker: maker,
                    schema: AssetSchema.ERC721,
                    count: order.itemCount
                }, this.apiOption)

                setCollectionFees(order.basicCollections, fees)
                setCollectionFees(order.collections, fees)
                orders.push({
                    exchange: this.elementEx.address.toLowerCase(),
                    maker: maker.toLowerCase(),
                    listingTime: listingTime,
                    expirationTime: expirationTime,
                    startNonce: nonce,
                    paymentToken: paymentToken,
                    platformFeeRecipient: platformFeeRecipient,
                    basicCollections: order.basicCollections,
                    collections: order.collections,
                    hashNonce: hashNonce.toString(),
                    chain: chain
                })
            } catch (e) {
                error = e
            }
        }

        if (orders.length == 0) {
            throw error
        }
        return orders
    }

    public async signOrder(order: BatchSignedERC721Order): Promise<BatchSignedERC721OrderRequest> {
        const typedData = getTypedData(order, this.web3Signer.chainId)
        const sign = await this.web3Signer.signTypedData(order.maker, typedData)
        const o = order as BatchSignedERC721OrderRequest
        o.v = sign.v
        o.r = sign.r
        o.s = sign.s
        o.hash = Web3Signer.getOrderHash(typedData)
        // const r = await this.helper.checkBSERC721Orders(o)
        // console.log(JSON.stringify(r))
        // console.log(JSON.stringify(o))
        return o
    }

    public async fillOrder(order: BatchSignedERC721OrderResponse, taker: string, gasParams: GasParams) {
        const tradeData = await fillBatchSignedOrder(order, taker, this.web3Signer)
        const from = await this.web3Signer.getCurrentAccount()
        const call: LimitedCallSpec = {
            from: from,
            to: this.elementEx.address,
            data: tradeData.data,
            value: tradeData.value,
            gasPrice: gasParams.gasPrice,
            maxPriorityFeePerGas: gasParams.maxPriorityFeePerGas,
            maxFeePerGas: gasParams.maxFeePerGas
        }
        return this.web3Signer.ethSend(call)
    }

    public async approveAndGetCounter(params: MakeERC721SellOrdersParams): Promise<number> {
        checkSellOrdersParams(params)

        const set: Set<string> = new Set
        for (const item of params.items) {
            set.add(item.erc721TokenAddress.toLowerCase())
        }

        const list: any[] = []
        for (const value of set.values()) {
            list.push({
                tokenType: 0,
                tokenAddress: value,
                operator: this.elementEx.address
            })
        }

        const owner = await this.web3Signer.getCurrentAccount()
        const r = await this.helper.getSDKApprovalsAndCounter(owner, list)
        for (let i = 0; i < list.length; i++) {
            if (r.approvals[i].eq(0)) {
                const tx = await this.web3Signer.approveERC721Proxy(owner, list[i].tokenAddress, this.elementEx.address, params)
                await tx.wait(1)
            }
        }
        return parseInt(r.elementCounter)
    }

    private async queryFees(params: MakeERC721SellOrdersParams): Promise<Map<string, Fees>> {
        const addressList: string[] = []
        for (const item of params.items) {
            const address = item.erc721TokenAddress.toLowerCase()
            if (!addressList.includes(address)) {
                addressList.push(address)
            }
        }
        const fees = await queryFees(addressList, this.apiOption)
        const map: Map<string, Fees> = new Map<string, Fees>()
        for (const fee of fees) {
            map.set(fee.contractAddress.toLowerCase(), fee)
        }
        return map
    }
}

export function getSucceedList(order: BatchSignedERC721Order, assets: any[]): OrderInformation[] {
    if (assets.length == 0) {
        return []
    }

    const map: Map<string, any> = new Map
    for (const collection of order.basicCollections) {
        for (const item of collection.items) {
            const key = (collection.nftAddress + ',' + item.nftId).toLowerCase()
            const value = {
                erc20TokenAmount: item.erc20TokenAmount
            }
            map.set(key, value)
        }
    }
    for (const collection of order.collections) {
        for (const item of collection.items) {
            const key = (collection.nftAddress + ',' + item.nftId).toLowerCase()
            const value = {
                erc20TokenAmount: item.erc20TokenAmount
            }
            map.set(key, value)
        }
    }

    const list: OrderInformation[] = []
    for (const asset of assets) {
        const assetContract = asset.assetContract?.toString().toLowerCase() || ''
        const tokenId = toString(asset.assetTokenId)
        const key = assetContract + ',' + tokenId
        const value = map.get(key)
        if (value) {
            list.push({
                contractAddress: assetContract,
                tokenId: tokenId,
                schema: AssetSchema.ERC721,
                standard: Standard.ElementEx,
                maker: order.maker,
                listingTime: order.listingTime,
                expirationTime: order.expirationTime,
                price: Number(ethers.utils.formatEther(value.erc20TokenAmount)),
                paymentToken: order.paymentToken,
                saleKind: SaleKind.BatchSignedERC721Order,
                side: OrderSide.SellOrder
            })
        }
    }
    return list
}

function checkSellOrdersParams(params: MakeERC721SellOrdersParams) {
    if (!params.items?.length) {
        throw Error(`makeERC721SellOrders failed, items.length error.`)
    }
    const set: Set<string> = new Set<string>()
    for (const item of params.items) {
        const key = item.erc721TokenAddress.toLowerCase() + ',' + toString(item.erc721TokenId)
        if (set.has(key)) {
            throw Error(`makeERC721SellOrders failed, the same asset is not supported, assetAddress(${item.erc721TokenAddress}, assetId(${item.erc721TokenId})).`)
        }
        set.add(key)
    }
}

function setCollectionFees(collections: Collection[], fees: Map<String, Fees>) {
    for (const collection of collections) {
        const fee = fees.get(collection.nftAddress)
        if (fee) {
            if (fee.protocolFeeAddress && fee.protocolFeeAddress.toLowerCase() != NULL_ADDRESS) {
                collection.platformFee = fee.protocolFeePoints || 0
            }
            if (fee.royaltyFeeAddress && fee.royaltyFeeAddress.toLowerCase() != NULL_ADDRESS) {
                collection.royaltyFee = fee.royaltyFeePoints || 0
                collection.royaltyFeeRecipient = fee.royaltyFeeAddress.toLowerCase()
            }
        }
        if (collection.platformFee < 0 || collection.royaltyFee < 0 || (collection.platformFee + collection.royaltyFee) > 10000) {
            throw Error(`makeERC721SellOrders failed, feePoint error, platformFeePoint(${collection.platformFee}, royaltyFeePoint(${collection.royaltyFee})`)
        }
    }
}

function getPlatformFeeRecipient(fees: Map<String, Fees>): string {
    let platformFeeRecipient
    for (const fee of fees.values()) {
        if (fee.protocolFeePoints) {
            const protocolFeeAddress = fee.protocolFeeAddress ? fee.protocolFeeAddress.toLowerCase() : NULL_ADDRESS
            if (platformFeeRecipient) {
                if (platformFeeRecipient != protocolFeeAddress) {
                    throw Error(`check platformFeeRecipient failed, platformFeeRecipient1(${platformFeeRecipient}), platformFeeRecipient2(${protocolFeeAddress})`)
                }
            } else {
                platformFeeRecipient = protocolFeeAddress
            }
        }
    }
    return platformFeeRecipient ? platformFeeRecipient : NULL_ADDRESS
}

function getOrders(items: ERC721SellOrderItem[]): any[] {
    const map: Map<string, any> = new Map
    for (const item of items) {
        if (!item.erc721TokenAddress || item.erc721TokenAddress.toLowerCase() == NULL_ADDRESS) {
            throw Error(`makeERC721SellOrders failed, tokenAddress(${item.erc721TokenAddress}) error.`)
        }
        if (item.erc721TokenId == null || item.erc721TokenId === '') {
            throw Error(`makeERC721SellOrders failed, tokenId(${item.erc721TokenId}) error.`)
        }

        let collection = map.get(item.erc721TokenAddress.toLowerCase())
        if (collection == null) {
            collection = {
                nftAddress: item.erc721TokenAddress.toLowerCase(),
                items: [],
                isBasic: true
            }
            map.set(collection.nftAddress, collection)
        }

        const obj = {
            erc20TokenAmount: toString(item.paymentTokenAmount),
            nftId: toString(item.erc721TokenId)
        }
        collection.items.push(obj)

        if (collection.isBasic) {
            if (maxBasicERC20Amount.lt(obj.erc20TokenAmount) || maxBasicNftId.lt(obj.nftId)) {
                collection.isBasic = false
            }
        }

        if (maxERC20Amount.lt(obj.erc20TokenAmount)) {
            throw Error(`makeERC721SellOrders failed, item.paymentTokenAmount(${obj.erc20TokenAmount} exceed the maxValue(${maxERC20Amount.toHexString()})).`)
        }
    }

    let point = 0
    let order: any = null
    const orders: any[] = []

    for (const value of map.values()) {
        if (isOrderFulled(point, 2, order)) {
            point = 0
            order = null
        }
        point += 2

        let collection
        const plusPoint = value.isBasic ? 1 : 2
        for (const item of value.items) {
            if (isOrderFulled(point, plusPoint, order)) {
                point = 2
                order = null
                collection = null
            }

            if (order == null) {
                order = {
                    basicCollections: [],
                    collections: [],
                    itemCount: 0
                }
                orders.push(order)
            }

            if (collection == null) {
                collection = {
                    nftAddress: value.nftAddress,
                    platformFee: 0,
                    royaltyFeeRecipient: NULL_ADDRESS,
                    royaltyFee: 0,
                    items: []
                }
                if (value.isBasic) {
                    order.basicCollections.push(collection)
                } else {
                    order.collections.push(collection)
                }
            }

            point += plusPoint
            order.itemCount++
            collection.items.push(item)
        }
    }
    return orders
}

function isOrderFulled(point: number, plusPoint: number, order: any) {
    if (point + plusPoint > 102) {
        return true
    }
    return order != null && order.itemCount >= 50
}

function getOrderTime(params: MakeERC721SellOrdersParams) {
    const now = Math.floor(Date.now() / 1000)

    let listingTime
    if (params.listingTime) {
        listingTime = params.listingTime
        if (listingTime > now + MAX_LISTING_TIME) {
            throw Error('makeERC721SellOrders failed, require listingTime <= now + 1 year.')
        }
        if (listingTime < (now - 3600)) {
            throw Error('makeERC721SellOrders failed, listingTime >= now - 1 hour.')
        }
    } else {
        listingTime = now - 60
    }

    let expirationTime
    if (params.expirationTime != null) {
        expirationTime = params.expirationTime
        if (expirationTime < Math.max(listingTime, now)) {
            throw Error('makeERC721SellOrders failed, require expirationTime >= Math.max(listingTime, now).')
        }
        if (expirationTime > Math.max(listingTime, now) + MAX_EXPIRATION_TIME) {
            throw Error('makeERC721SellOrders failed, require expirationTime <= Math.max(listingTime, now) + 1 year.')
        }
    } else {
        expirationTime = Math.max(listingTime, now) + DEFAULT_EXPIRATION_TIME
    }
    return { listingTime, expirationTime }
}
