import { BigNumber, ethers } from 'ethers'
import { ContractABI } from '../contracts/abi'
import { NULL_ADDRESS } from '../types/types'
import { TradeDetails } from './swapTypes'
import { getSeaportMarketId } from '../util/marketUtil'
import { toString } from '../util/numberUtil'

const seaport = new ethers.Contract(NULL_ADDRESS, ContractABI.seaport.abi)
const BYTE32_0 = '0x0000000000000000000000000000000000000000000000000000000000000000'

export async function encodeSeaportOrder(exchangeData: string, account: string): Promise<TradeDetails> {
    const order = JSON.parse(exchangeData)
    if (order.parameters.offer == null) {
        order.parameters.offer = []
    }
    if (order.parameters.consideration == null) {
        order.parameters.consideration = []
    }
    
    let value = BigNumber.from('0')
    for (const item of order.parameters.consideration) {
        value = value.add(toString(item.startAmount))
    }
    const advancedOrder = {
        parameters: order.parameters,
        numerator: 1,
        denominator: 1,
        signature: order.signature,
        extraData: '0x'
    }
    const data = await seaport.populateTransaction.fulfillAdvancedOrder(advancedOrder, [], BYTE32_0, account)
    return {
        marketId: getSeaportMarketId(),
        value: value.toString(),
        data: data.data as any
    }
}

