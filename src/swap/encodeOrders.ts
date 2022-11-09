import { TradeDetails } from './swapTypes'
import { BigNumber, ethers, BigNumberish } from 'ethers'
import { NULL_ADDRESS, OrderDetail } from '../types/types'
import { ContractABI } from '../contracts/abi'
import { toString } from '../util/numberUtil'

const elementEx = new ethers.Contract(NULL_ADDRESS, ContractABI.elementEx.abi)

export async function encodeOrder(orderDetails: OrderDetail, taker: string, marketId: string | number): Promise<TradeDetails | null> {
    const signedOrder = JSON.parse(orderDetails.exchangeData)
    const sig = signedOrder.signature
    const order = signedOrder.order
    if (order.fees == null) {
        order.fees = []
    }
    if (orderDetails.schema?.toLowerCase() == 'erc721') {
        const value = _calcValue(order, 1, 1)
        const tx = await elementEx.populateTransaction.buyERC721Ex(order, sig, taker, '0x')
        return {
            marketId: marketId,
            value: value.toString(),
            data: tx.data as any
        }
    } else if (orderDetails.schema?.toLowerCase() == 'erc1155') {
        const quantity = toString(orderDetails.quantity)
        const value = _calcValue(order, quantity, order.erc1155TokenAmount)
        const tx = await elementEx.populateTransaction.buyERC1155Ex(order, sig, taker, quantity, '0x')
        return {
            marketId: marketId,
            value: value.toString(),
            data: tx.data as any
        }
    } else {
        return null
    }
}

function _calcValue(order: any, quantity: any, totalQuantity): BigNumber {
    let value = _ceilDiv(BigNumber.from(order.erc20TokenAmount).mul(quantity), totalQuantity)
    for (const fee of order.fees) {
        const amount = BigNumber.from(fee.amount).mul(quantity).div(totalQuantity)
        value = value.add(amount)
    }
    return value
}

function _ceilDiv(a: BigNumber, b: BigNumberish): BigNumber {
    // ceil(a / b) = floor((a + b - 1) / b)
    return a.add(b).sub(1).div(b)
}
