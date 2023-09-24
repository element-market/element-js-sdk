import { TradeDetails } from './swapTypes'
import { LimitedCallSpec, Web3Signer } from '../signer/Web3Signer'
import { BigNumber, Contract } from 'ethers'
import { ContractABI } from '../contracts/contracts'
import { NULL_ADDRESS, OrderDetail, SaleKind, Standard } from '../types/types'
import { BatchSignedERC721OrderResponse } from '../element/batchSignedOrder/batchSignedTypes'
import { encodeBits } from '../util/bitsUtil'
import { getElementMarketId } from '../util/marketUtil'
import { encodeBatchSignedOrders } from './encodeBatchSignedOrders'
import { encodeBasicOrders } from './encodeBasicOrders'
import { encodeOrder } from './encodeOrders'
import { CONTRACTS_ADDRESSES } from '../contracts/config'

export class Swap {
    
    public web3Signer: Web3Signer
    
    constructor(web3Signer: Web3Signer) {
        this.web3Signer = web3Signer
    }
    
    public async encodeTradeData(tag: string, orders: Array<OrderDetail>, taker?: string): Promise<LimitedCallSpec> {
        if (!orders || orders.length == 0) {
            throw Error(`${tag} failed, orders.length error.`)
        }
        
        if (taker == null || taker == '' || taker.toLowerCase() == NULL_ADDRESS) {
            taker = await this.web3Signer.getCurrentAccount()
        }
        
        const tradeDetails = await this.toTradeDetails(orders, taker.toLowerCase())
        if (!tradeDetails || tradeDetails.length == 0) {
            throw Error(`${tag} failed, no valid orders.`)
        }
        
        const call: any = {}
        if (tradeDetails.length == 1 && tradeDetails[0].marketId.toString() == getElementMarketId(this.web3Signer.chainId)) {
            call.to = this.getElementEx().address.toLowerCase()
            call.data = tradeDetails[0].data
            call.value = tradeDetails[0].value
        } else {
            let value = BigNumber.from(0)
            for (const item of tradeDetails) {
                value = value.add(item.value)
            }
            call.value = value.toString()
    
            const swapEx = this.getSwapEx()
            call.to = swapEx.address.toLowerCase()
    
            const tradeBytes = toTradeBytes([], tradeDetails)
            const tx = await swapEx.populateTransaction.batchBuyWithETH(tradeBytes, { value: call.value })
            call.data = tx.data
        }
        return call
    }
    
    private getElementEx() {
        const address = CONTRACTS_ADDRESSES[this.web3Signer.chainId].ElementEx
        return new Contract(address, ContractABI.elementEx.abi)
    }
    
    private getSwapEx() {
        const address = CONTRACTS_ADDRESSES[this.web3Signer.chainId].ElementExSwapV2
        return new Contract(address, ContractABI.elementExSwap.abi)
    }
    
    private async toTradeDetails(orders: Array<OrderDetail>, taker: string): Promise<Array<TradeDetails>> {
        const elementMarketId = getElementMarketId(this.web3Signer.chainId)
        
        const batchSignedERC721Orders: BatchSignedERC721OrderResponse[] = []
        const basicOrders: any[] = []
        
        const list: any[] = []
        for (const order of orders) {
            if (!order.exchangeData) {
                continue
            }
            
            const standard = order.standard?.toLowerCase()
            if (standard == Standard.ElementEx) {
                if (Number(order.saleKind) == SaleKind.BatchSignedERC721Order) {
                    if (batchSignedERC721Orders.length == 0) {
                        list.push(batchSignedERC721Orders)
                    }
                    batchSignedERC721Orders.push(JSON.parse(order.exchangeData))
                } else {
                    if (order.schema?.toLowerCase() == 'erc721' && Number(order.price) <= 0xffffffff) {
                        if (basicOrders.length == 0) {
                            list.push(basicOrders)
                        }
                        basicOrders.push(JSON.parse(order.exchangeData))
                    } else {
                        const tradeDetail = await encodeOrder(order, taker, elementMarketId)
                        if (tradeDetail) {
                            list.push(tradeDetail)
                        }
                    }
                }
            }
        }
        
        const tradeDetails: TradeDetails[] = []
        for (const item of list) {
            if (item === batchSignedERC721Orders) {
                const tradeDetail = await encodeBatchSignedOrders(batchSignedERC721Orders, taker, elementMarketId)
                if (tradeDetail) {
                    tradeDetails.push(tradeDetail)
                }
            } else if (item === basicOrders) {
                const tradeDetailList = await encodeBasicOrders(basicOrders, taker, elementMarketId)
                if (tradeDetailList?.length) {
                    tradeDetails.push(...tradeDetailList)
                }
            } else {
                tradeDetails.push(item)
            }
        }
        return tradeDetails
    }
}

function toTradeBytes(conversions: Array<TradeDetails>, tradeDetails: Array<TradeDetails>): string {
    let bytes = '0x'
    for (const item of conversions) {
        bytes += toItemBytes(item, false)
    }
    
    const continueIfFailed = tradeDetails.length > 1
    for (const item of tradeDetails) {
        bytes += toItemBytes(item, continueIfFailed)
    }
    return bytes
}

function toItemBytes(item: TradeDetails, continueIfFailed: boolean) {
    const tradeData = item.data.startsWith('0x') ? item.data.substring(2) : item.data
    if (tradeData.length % 2 !== 0) {
        throw Error(`batchBuyWithETH failed, tradeData.length(${tradeData.length}) error.`)
    }
    
    // 16 bits(marketId) + 8 bits(continueIfFailed) + 168 bits(ethValue) + 32 bits(itemLength)
    const head = encodeBits([
        [item.marketId, 16],
        [continueIfFailed ? 1 : 0, 8],
        [item.value, 168],
        [tradeData.length / 2, 32]
    ])
    return head.substring(2) + tradeData
}
