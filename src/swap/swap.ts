import { TradeDetails } from './swapTypes'
import { Web3Signer } from '../signer/Web3Signer'
import { BigNumber, Contract } from 'ethers'
import { getElementExContract, getElementExSwapContract } from '../contracts/contracts'
import { GasParams, OrderDetail, SaleKind, Standard } from '../types/types'
import { BatchSignedERC721OrderResponse } from '../element/batchSignedOrder/batchSignedTypes'
import { encodeBits } from '../util/bitsUtil'
import { getElementMarketId } from '../util/marketUtil'
import { encodeSeaportOrder } from './encodeSeaportOrders'
import { encodeLooksRareOrder } from './encodeLooksRareOrders'
import { TransactionResponse } from '@ethersproject/abstract-provider'
import { encodeBatchSignedOrders } from './encodeBatchSignedOrders'
import { encodeBasicOrders } from './encodeBasicOrders'
import { encodeOrder } from './encodeOrders'

export class Swap {
    
    public web3Signer: Web3Signer
    public elementEx: Contract
    public swapEx: Contract
    
    constructor(web3Signer: Web3Signer) {
        this.web3Signer = web3Signer
        this.elementEx = getElementExContract(web3Signer.chainId)
        this.swapEx = getElementExSwapContract(web3Signer.chainId)
    }
    
    public async batchBuyWithETH(orders: Array<OrderDetail>, gasParams: GasParams): Promise<TransactionResponse> {
        if (!orders || orders.length == 0) {
            throw Error(`batchBuyWithETH failed, orders.length error.`)
        }
        
        const tradeDetails = await this.toTradeDetails(orders)
        if (!tradeDetails || tradeDetails.length == 0) {
            throw Error(`batchBuyWithETH failed, no valid orders.`)
        }
        
        const account = await this.web3Signer.getCurrentAccount()
        const call: any = {
            from: account,
            gasPrice: gasParams.gasPrice,
            maxPriorityFeePerGas: gasParams.maxPriorityFeePerGas,
            maxFeePerGas: gasParams.maxFeePerGas
        }
        
        if (tradeDetails.length == 1 && tradeDetails[0].marketId.toString() == getElementMarketId(this.web3Signer.chainId)) {
            call.to = this.elementEx.address
            call.data = tradeDetails[0].data
            call.value = tradeDetails[0].value
        } else {
            let value = BigNumber.from(0)
            for (const item of tradeDetails) {
                value = value.add(item.value)
            }
            call.value = value.toString()
            call.to = this.swapEx.address
            
            const tradeBytes = toTradeBytes([], tradeDetails)
            const tx = await this.swapEx.populateTransaction.batchBuyWithETH(tradeBytes, { value: call.value })
            call.data = tx.data
        }
        return this.web3Signer.ethSend(call)
    }
    
    private async toTradeDetails(orders: Array<OrderDetail>): Promise<Array<TradeDetails>> {
        const taker = await this.web3Signer.getCurrentAccount()
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
            } else if (standard == Standard.Seaport) {
                if (this.web3Signer.chainId == 1 || this.web3Signer.chainId == 5) {
                    const tradeDetail = await encodeSeaportOrder(order.exchangeData, taker)
                    list.push(tradeDetail)
                }
            } else if (standard == Standard.LooksRare) {
                if (this.web3Signer.chainId == 1 || this.web3Signer.chainId == 5) {
                    const tradeDetail = await encodeLooksRareOrder(order.exchangeData)
                    list.push(tradeDetail)
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
