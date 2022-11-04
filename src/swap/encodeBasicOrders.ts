import { BigNumber, ethers } from 'ethers'
import { ContractABI } from '../contracts/abi'
import { NULL_ADDRESS } from '../types/types'
import { encodeBits } from '../util/bitsUtil'
import { TradeDetails } from './swapTypes'

const MASK_80 = '0xffffffffffffffffffff'
const elementExV3 = new ethers.Contract(NULL_ADDRESS, ContractABI.elementEx.abi)

export async function encodeBasicOrders(orders: any[], taker: string, marketId: string | number): Promise<Array<TradeDetails>> {
    if (orders == null || orders.length == 0) {
        return []
    }
    
    const stats = _getStats(orders)
    
    const map: Map<string, Array<any>> = new Map<string, Array<any>>()
    for (let i = 0; i < orders.length; i++) {
        const list = map.get(stats[i])
        if (list) {
            const index = list.findIndex(function(item, index, arr) {
                return item.signature.v == orders[i].signature.v && item.signature.r == orders[i].signature.r && item.signature.s == orders[i].signature.s
            })
            if (index == -1) {
                list.push(orders[i])
            }
        } else {
            map.set(stats[i], [orders[i]])
        }
    }
    
    const tradeDetails: TradeDetails[] = []
    for (const [key, list] of map.entries()) {
        if (key == '' || list.length < 2) {
            for (const order of list) {
                const tradeDetail = await _encodeBasicOrder(order, taker, marketId)
                tradeDetails.push(tradeDetail)
            }
        } else {
            const fees: string[] = []
            if (key.includes('_')) {
                const splits = key.split('_')
                for (let i = 1; i < splits.length; i++) {
                    fees.push(splits[i])
                }
            }
            const tradeDetail = await _encodeBasicOrdersFromSingleCollection(list, taker, fees, marketId)
            tradeDetails.push(tradeDetail)
        }
    }
    return tradeDetails
}

async function _encodeBasicOrder(basicOrder: any, taker: string, marketId: string | number): Promise<TradeDetails> {
    const order = basicOrder.order
    const sig = basicOrder.signature
    let value = BigNumber.from(order.erc20TokenAmount)
    
    /// @param data1 [96 bits(ethTokenAmount) + 160 bits(maker)]
    const data1 = encodeBits([
        [order.erc20TokenAmount, 96],
        [order.maker, 160]
    ])
    
    /// @param data2 [32 bits(listingTime) + 32 bits(expiryTime) + 32 bits(unused) + 160 bits(taker)]
    const data2 = encodeBits([
        [order.expiry, 64],
        [0, 32],
        [taker, 160]
    ])
    
    /// @param data3 [64 bits(nonce) + 8 bits(v) + 24 bits(unused) + 160 bits(nftAddress)]
    const data3 = encodeBits([
        [order.nonce, 64],
        [sig.v, 8],
        [0, 24],
        [order.nft, 160]
    ])
    
    let fee1 = '0'
    let fee2 = '0'
    if (order.fees) {
        /// fee1 [96 bits(amount) + 160 bits(recipient)]
        if (order.fees.length > 0) {
            const fee = order.fees[0]
            fee1 = encodeBits([
                [fee.amount, 96],
                [fee.recipient, 160]
            ])
            value = value.add(fee.amount)
        }
        
        /// fee2 [96 bits(amount) + 160 bits(recipient)]
        if (order.fees.length > 1) {
            const fee = order.fees[1]
            fee2 = encodeBits([
                [fee.amount, 96],
                [fee.recipient, 160]
            ])
            
            value = value.add(fee.amount)
        }
    }
    
    const parameter = {
        data1: data1,
        data2: data2,
        data3: data3,
        nftId: order.nftId,
        fee1: fee1,
        fee2: fee2,
        r: encodeBits([[sig.r, 256]]),
        s: encodeBits([[sig.s, 256]])
    }
    const data = await elementExV3.populateTransaction.fillBasicERC721Order(parameter)
    return {
        marketId: marketId,
        value: value.toString(),
        data: data.data as any
    }
}

async function _encodeBasicOrdersFromSingleCollection(orders: any[], taker: string, fees: string[], marketId: string | number): Promise<TradeDetails> {
    /// @param parameter1 [8 bits(revertIfIncomplete) + 88 bits(unused) + 160 bits(nftAddress)]
    const parameter1 = encodeBits([
        [0, 8],
        [0, 88],
        [orders[0].order.nft, 160]
    ])
    
    const takerPart1 = BigNumber.from(taker).shr(80).toHexString()
    const takerPart2 = BigNumber.from(taker).and(MASK_80).toHexString()
    
    /// @param parameter2 [80 bits(taker part1) + 16 bits(feePercentage1) + 160 bits(feeRecipient1)]
    const fee1 = fees.length > 0 ? fees[0] : '0'
    const parameter2 = encodeBits([
        [takerPart1, 80],
        [fee1, 176]
    ])
    
    /// @param parameter3 [80 bits(taker part2) + 16 bits(feePercentage2) + 160 bits(feeRecipient2)]
    const fee2 = fees.length > 1 ? fees[1] : '0'
    const parameter3 = encodeBits([
        [takerPart2, 80],
        [fee2, 176]
    ])
    
    let value = BigNumber.from(0)
    
    const list: any[] = []
    for (const item of orders) {
        const order = item.order
        const sig = item.signature
        
        const ethAmount = _callETHAmount(order)
        value = value.add(ethAmount)
        
        /// @param extra [96 bits(ethAmount) + 64 bits(nonce) + 8 bits(v) + 24 bits(unused) + 32 bits(listingTime) + 32 bits(expiryTime)]
        const extra = encodeBits([
            [ethAmount, 96],
            [order.nonce, 64],
            [sig.v, 8],
            [0, 24],
            [order.expiry, 64]
        ])
        
        list.push({
            maker: order.maker,
            extra: extra,
            nftId: order.nftId,
            r: encodeBits([[sig.r, 256]]),
            s: encodeBits([[sig.s, 256]])
        })
    }
    
    const parameters = {
        parameter1: parameter1,
        parameter2: parameter2,
        parameter3: parameter3
    }
    
    const data = await elementExV3.populateTransaction.fillBasicERC721Orders(parameters, list)
    return {
        marketId: marketId,
        value: value.toString(),
        data: data.data as any
    }
}

function _callETHAmount(order: any): BigNumber {
    let amount = BigNumber.from(order.erc20TokenAmount)
    if (order.fees && order.fees.length > 0) {
        for (const fee of order.fees) {
            amount = amount.add(fee.amount)
        }
    }
    return amount
}

function _getStats(orders: any[]): string[] {
    const stats: string[] = []
    for (const item of orders) {
        const nftAddress = item.order.nft.toLowerCase()
        const feesString = _getFeesString(item.order)
        if (feesString == null) {
            stats.push('')
        } else if (feesString.length == 0) {
            stats.push(nftAddress)
        } else {
            stats.push(nftAddress + '_' + feesString)
        }
    }
    return stats
}

function _getFeesString(order: any): string | null {
    if (order.fees && order.fees.length > 0) {
        if (order.fees.length >= 3) {
            return null
        }
        
        let feesString: string = ''
        let amount = BigNumber.from(order.erc20TokenAmount)
        for (const fee of order.fees) {
            amount = amount.add(fee.amount)
        }
        
        for (const fee of order.fees) {
            let feeString = ''
            if (amount.gt(0)) {
                const feePercentage = BigNumber.from(fee.amount).mul(10000).div(amount)
                if (!(amount.mul(feePercentage).div(10000).eq(fee.amount))) {
                    return null
                }
                feeString = encodeBits([
                    [feePercentage, 16],
                    [fee.recipient, 160]
                ])
            } else {
                feeString = encodeBits([
                    [0, 16],
                    [fee.recipient, 160]
                ])
            }
            if (feesString.length > 0) {
                feesString += '_' + feeString
            } else {
                feesString = feeString
            }
        }
        return feesString.toLowerCase()
    }
    return ''
}
