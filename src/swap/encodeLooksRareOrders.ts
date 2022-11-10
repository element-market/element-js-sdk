import { ethers } from 'ethers'
import { ContractABI } from '../contracts/abi'
import { NULL_ADDRESS } from '../types/types'
import { TradeDetails } from './swapTypes'
import { getLooksRareMarketId } from '../util/marketUtil'
import { toString } from '../util/numberUtil'

const looksRare = new ethers.Contract(NULL_ADDRESS, ContractABI.looksRare.abi)

export async function encodeLooksRareOrder(exchangeData: string, taker: string): Promise<TradeDetails> {
    const order = JSON.parse(exchangeData)
    if (!order.params) {
        order.params = '0x'
    }
    
    const takerOrder = {
        isOrderAsk: !order.isOrderAsk,
        taker: taker,
        price: order.price,
        tokenId: order.tokenId,
        minPercentageToAsk: order.minPercentageToAsk,
        params: order.params
    }
    
    const data = await looksRare.populateTransaction.matchAskWithTakerBidUsingETHAndWETH(takerOrder, order)
    return {
        marketId: getLooksRareMarketId(),
        value: toString(order.price),
        data: data.data as any
    }
}

