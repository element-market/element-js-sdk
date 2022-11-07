import { SwapTradeData, TradeDetails } from './swapTypes'
import { Web3Signer } from '../signer/Web3Signer'
import { BigNumber, Contract } from 'ethers'
import { getElementExContract, getElementExSwapContract } from '../contracts/contracts'
import { GasParams, NULL_ADDRESS, OrderSide, Standard } from '../types/types'
import { BatchSignedERC721OrderResponse } from '../element/batchSignedOrder/batchSignedTypes'
import { encodeBasicOrders } from './encodeBasicOrders'
import { encodeBatchSignedOrders } from './encodeBatchSignedOrders'
import { encodeBits } from '../util/bitsUtil'
import { getElementMarketId } from '../util/marketUtil'
import { encodeSeaportOrder } from './encodeSeaportOrders'
import { encodeLooksRareOrder } from './encodeLooksRareOrders'

const MASK_96 = '0xffffffffffffffffffffffff'

export class Swap {
    
    public web3Signer: Web3Signer
    public elementEx: Contract
    public swapEx: Contract
    
    constructor(web3Signer: Web3Signer) {
        this.web3Signer = web3Signer
        this.elementEx = getElementExContract(web3Signer.chainId)
        this.swapEx = getElementExSwapContract(web3Signer.chainId)
    }
    
    public async batchBuyWithETH(tradeDatas: Array<SwapTradeData>, gasParams: GasParams) {
        if (!tradeDatas || tradeDatas.length == 0) {
            throw Error(`batchBuyWithETH failed, tradeDatas.length error.`)
        }
        
        const tradeDetails = await this.toTradeDetails(tradeDatas)
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
    
    private async toTradeDetails(tradeDatas: Array<SwapTradeData>): Promise<Array<TradeDetails>> {
        const taker = await this.web3Signer.getCurrentAccount()
        
        const basicOrders: any[] = []
        const batchSignedERC721Orders: BatchSignedERC721OrderResponse[] = []
        
        const flags: number[] = []
        const elementMarketId = getElementMarketId(this.web3Signer.chainId)
        for (let i = 0; i < tradeDatas.length; i++) {
            const data = tradeDatas[i]
            if (
                elementMarketId == data.marketId?.toString() &&
                data.exchangeData &&
                data.schema?.toLowerCase() == 'erc721' &&
                data.value &&
                BigNumber.from(data.value).lte(MASK_96)
            ) {
                const order = JSON.parse(data.exchangeData)
                if (order.order) {
                    basicOrders.push(order)
                    flags.push(0)
                } else {
                    batchSignedERC721Orders.push(order as BatchSignedERC721OrderResponse)
                    flags.push(1)
                }
            } else if (!data.errorDetail?.length) {
                flags.push(2)
            } else if (
                data.exchangeData &&
                data.paymentToken == NULL_ADDRESS &&
                data.saleKind == 0 &&
                data.side == OrderSide.SellOrder &&
                (this.web3Signer.chainId == 1 || this.web3Signer.chainId == 5)
            ) {
                if (data.standard?.toLowerCase() == Standard.Seaport) {
                    const tradeData = await encodeSeaportOrder(data.exchangeData, taker)
                    data.data = tradeData.data
                    data.marketId = tradeData.marketId
                    data.value = tradeData.value
                    flags.push(2)
                } else if (data.standard?.toLowerCase() == Standard.LooksRare) {
                    const tradeData = await encodeLooksRareOrder(data.exchangeData)
                    data.data = tradeData.data
                    data.marketId = tradeData.marketId
                    data.value = tradeData.value
                    flags.push(2)
                } else {
                    flags.push(3)
                }
            } else {
                flags.push(3)
            }
        }
        
        let basicOrdersTradeDetails: TradeDetails[] = []
        if (basicOrders.length > 0) {
            basicOrdersTradeDetails = await encodeBasicOrders(basicOrders, taker, elementMarketId)
        }
        
        let batchSignedERC721TradeDetail: TradeDetails | null = null
        if (batchSignedERC721Orders.length > 0) {
            batchSignedERC721TradeDetail = await encodeBatchSignedOrders(batchSignedERC721Orders, taker, elementMarketId)
        }
        
        let isBasicOrdersAdd = false
        let isBatchSignedERC721OrderAdd = false
        
        const tradeDetails: TradeDetails[] = []
        for (let i = 0; i < tradeDatas.length; i++) {
            switch (flags[i]) {
                case 0:
                    if (basicOrdersTradeDetails.length > 0) {
                        if (!isBasicOrdersAdd) {
                            tradeDetails.push(...basicOrdersTradeDetails)
                            isBasicOrdersAdd = true
                        }
                    }
                    break
                case 1:
                    if (batchSignedERC721TradeDetail != null) {
                        if (!isBatchSignedERC721OrderAdd) {
                            tradeDetails.push(batchSignedERC721TradeDetail)
                            isBatchSignedERC721OrderAdd = true
                        }
                    }
                    break
                case 2:
                    tradeDetails.push(tradeDatas[i])
                    break
                default:
                    break
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
