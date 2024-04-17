import { getChainId } from './util/chainUtil'
import {
  postBatchSignedERC721SellOrder,
  postOrder,
  queryFees,
  queryNonce,
  queryOracleSignature,
  queryOrders,
  queryTradeData
} from './api/openApi'
import { TransactionReceipt, TransactionResponse } from '@ethersproject/abstract-provider'
import {
  Asset,
  AssetSchema,
  BatchBuyWithETHParams,
  CancelAllOrdersByMakerParams,
  CancelOrderParams,
  CancelOrdersParams,
  CancelOrdersResponse,
  CancelOrdersTransaction,
  ElementAPIConfig,
  EncodeTradeDataParams,
  FailedERC721Item,
  FillOrderParams,
  MakeERC721SellOrdersParams,
  MakeERC721SellOrdersResponse,
  MakeOrderParams,
  NULL_ADDRESS,
  Order,
  OrderInformation,
  OrderSide,
  SaleKind,
  Standard,
  TradeData
} from './types/types'
import { LimitedCallSpec, Web3Signer } from './signer/Web3Signer'
import { BatchSignedOrderManager, getSucceedList } from './element/batchSignedOrder/batchSignedOrderManager'
import { OrderManager } from './element/order/orderManager'
import { ApiOption, OrderQuery } from './api/openApiTypes'
import { CreateOrderParams } from './element/order/orderTypes'
import { toOrderInformation, toOrderRequest } from './element/order/orderConverter'
import { toNumber, toString } from './util/numberUtil'
import { getBoughtAssets } from './util/receiptUtil'
import { approveERC20, erc20Decimals, setApproveForAll } from './util/assetUtil'
import { ethers } from 'ethers'
import { toStandardERC20Token } from './util/tokenUtil'

export class ElementSDK {
  
  public chainId: number
  public apiOption: ApiOption
  public web3Signer: Web3Signer
  public batchOrderManager: BatchSignedOrderManager
  public orderManager: OrderManager
  public isTestnet: boolean = false
  
  constructor(config: ElementAPIConfig) {
    if (config.isTestnet != null) {
      this.isTestnet = config.isTestnet
    }
    this.chainId = getChainId(config.networkName, this.isTestnet)
    this.apiOption = {
      chain: config.networkName,
      isTestnet: this.isTestnet,
      apiKey: config.apiKey
    }
    this.web3Signer = new Web3Signer(config.signer, this.chainId)
    this.batchOrderManager = new BatchSignedOrderManager(this.web3Signer, this.apiOption)
    this.orderManager = new OrderManager(this.web3Signer)
  }
  
  public async makeERC721SellOrders(params: MakeERC721SellOrdersParams): Promise<MakeERC721SellOrdersResponse> {
    let error
    const succeedList: OrderInformation[] = []
    const failedList: FailedERC721Item[] = []
    
    // 1. setApproveForAll
    const counter = await this.batchOrderManager.approveAndGetCounter(params)
    
    // 2. create orders
    const orders = await this.batchOrderManager.createOrders(params, counter)
    for (const order of orders) {
      try {
        // 3. sign order
        const signedOrder = await this.batchOrderManager.signOrder(order)
        
        // 4. post order
        const r = await postBatchSignedERC721SellOrder(signedOrder, this.apiOption)
        succeedList.push(...getSucceedList(signedOrder, r.successList))
        failedList.push(...r.failList)
      } catch (e) {
        error = e
      }
    }
    
    if (succeedList.length == 0 && failedList.length == 0) {
      throw error
    }
    return {
      succeedList: succeedList,
      failedList: failedList
    }
  }
  
  public async makeSellOrder(params: MakeOrderParams): Promise<OrderInformation> {
    if (params.assetId == null) {
      throw Error('createSellOrder failed, asset.id is undefined.')
    }
    
    if (
      (!params.assetSchema || params.assetSchema.toLowerCase() == 'erc721') &&
      (!params.takerAddress || params.takerAddress.toLowerCase() == NULL_ADDRESS)
    ) {
      const r = await this.makeERC721SellOrders({
        listingTime: params.listingTime,
        expirationTime: params.expirationTime,
        paymentToken: params.paymentToken,
        items: [ {
          erc721TokenId: toString(params.assetId),
          erc721TokenAddress: params.assetAddress,
          paymentTokenAmount: toString(params.paymentTokenAmount)
        } ],
        gasPrice: params.gasPrice,
        maxFeePerGas: params.maxFeePerGas,
        maxPriorityFeePerGas: params.maxPriorityFeePerGas
      })
      if (!r.succeedList?.length) {
        const e = r.failedList?.length ? r.failedList[0].errorDetail : ''
        throw Error('createSellOrder failed, ' + e)
      }
      return r.succeedList[0]
    }
    return await this.makeOrder(params, false)
  }
  
  public async makeBuyOrder(params: MakeOrderParams): Promise<OrderInformation> {
    return await this.makeOrder(params, true)
  }
  
  public async fillOrder(params: FillOrderParams): Promise<TransactionResponse> {
    if (params.order.standard?.toString().toLowerCase() != Standard.ElementEx) {
      throw Error(`fillOrder failed, standard(${ params.order.standard }) is not supported`)
    }
    
    const account = await this.web3Signer.getCurrentAccount()
    
    const takeCount = params.quantity ? (Number(params.quantity) || 1) : 1
    if (params.order.side === OrderSide.SellOrder) {
      if (toStandardERC20Token(params.order.paymentToken) !== NULL_ADDRESS) {
        const decimals = await erc20Decimals(this.web3Signer, params.order.paymentToken)
        const payValue = takeCount * Number(params.order.price)
        const value = ethers.utils.parseUnits(payValue.toString(), decimals)
        await approveERC20(this.web3Signer, params.order.paymentToken, value, params)
      }
    } else {
      await setApproveForAll(this.web3Signer, params.order.contractAddress, params)
    }
    
    if (
      params.order.saleKind === SaleKind.ContractOffer ||
      params.order.saleKind === SaleKind.BatchOfferERC721s
    ) {
      if (!params.assetId?.toString()) {
        throw Error(`fillOrder failed, Collection-Based Offer requires the \`assetId\`.`)
      }
    }
    const tradeData = await queryTradeData(account, [ {
      orderId: params.order.orderId,
      takeCount,
      tokenId: params.assetId?.toString()
    } ], this.apiOption)
    const call: LimitedCallSpec = {
      from: account,
      to: tradeData.to,
      value: tradeData.value,
      data: tradeData.data,
      gasPrice: params.gasPrice,
      maxPriorityFeePerGas: params.maxPriorityFeePerGas,
      maxFeePerGas: params.maxFeePerGas
    }
    return this.web3Signer.ethSend(call)
  }
  
  public async batchBuyWithETH(params: BatchBuyWithETHParams): Promise<TransactionResponse> {
    const taker = await this.web3Signer.getCurrentAccount()
    const list = this.toOrderIdList(params.orders, params.quantities)
    const tradeData = await queryTradeData(taker, list, this.apiOption)
    const call: LimitedCallSpec = {
      from: taker,
      to: tradeData.to,
      value: tradeData.value,
      data: tradeData.data,
      gasPrice: params.gasPrice,
      maxPriorityFeePerGas: params.maxPriorityFeePerGas,
      maxFeePerGas: params.maxFeePerGas
    }
    return this.web3Signer.ethSend(call)
  }
  
  public async encodeTradeData(params: EncodeTradeDataParams): Promise<TradeData> {
    let taker = params.taker
    if (taker == null || taker == '' || taker.toLowerCase() == NULL_ADDRESS) {
      taker = await this.web3Signer.getCurrentAccount()
    }
    const list = this.toOrderIdList(params.orders, params.quantities, params.tokenIds)
    const tradeData = await queryTradeData(taker, list, this.apiOption)
    return {
      toContract: tradeData.to,
      payableValue: tradeData.value,
      data: tradeData.data,
      flags: tradeData.flags
    }
  }
  
  public getBoughtAssets(receipt: TransactionReceipt): Array<Asset> {
    return getBoughtAssets(receipt)
  }
  
  public async cancelOrder(params: CancelOrderParams): Promise<TransactionResponse> {
    const account = await this.web3Signer.getCurrentAccount()
    if (params.order?.maker?.toLowerCase() != account.toLowerCase()) {
      throw Error(`cancelOrder failed, account mismatch, order.maker(${ params.order?.maker }), account(${ account }).`)
    }
    const signedOrder = JSON.parse(params.order.exchangeData)
    if (params.order.standard?.toString().toLowerCase() == Standard.ElementEx) {
      if (params.order.schema.toLowerCase() == AssetSchema.ERC721.toLowerCase()) {
        return this.orderManager.cancelERC721Orders([ signedOrder ], params)
      } else if (params.order.schema.toLowerCase() == AssetSchema.ERC1155.toLowerCase()) {
        return this.orderManager.cancelERC1155Orders([ signedOrder ], params)
      } else {
        throw Error('cancelOrder failed, unsupported schema : ' + params.order.schema)
      }
    } else {
      throw Error('cancelOrder failed, unsupported standard : ' + params.order.standard)
    }
  }
  
  public async cancelOrders(params: CancelOrdersParams): Promise<CancelOrdersResponse> {
    if (!params.orders?.length) {
      throw Error(`cancelOrders failed, orders?.length error.`)
    }
    
    const account = await this.web3Signer.getCurrentAccount()
    params.orders.forEach((value, index, array) => {
      if (account.toLowerCase() != value.maker?.toLowerCase()) {
        throw Error(`cancelOrders failed, account mismatch, index=(${ index }), order.maker(${ value.maker }), account(${ account }).`)
      }
    })
    
    const elementERC721Orders: Order[] = []
    const elementERC1155Orders: Order[] = []
    const elementERC721SignedOrders: any[] = []
    const elementERC1155SignedOrders: any[] = []
    
    for (const order of params.orders) {
      if (order.exchangeData && order.standard) {
        const signedOrder = JSON.parse(order.exchangeData)
        if (order.standard.toLowerCase() == Standard.ElementEx) {
          if (order.schema?.toLowerCase() == AssetSchema.ERC721.toLowerCase()) {
            elementERC721Orders.push(order)
            elementERC721SignedOrders.push(signedOrder)
          } else if (order.schema?.toLowerCase() == AssetSchema.ERC1155.toLowerCase()) {
            elementERC1155Orders.push(order)
            elementERC1155SignedOrders.push(signedOrder)
          }
        }
      }
    }
    
    const succeedTransactions: Array<CancelOrdersTransaction> = []
    if (elementERC721Orders.length > 0) {
      const tx = await this.orderManager.cancelERC721Orders(elementERC721SignedOrders, params)
      succeedTransactions.push({
        orders: elementERC721Orders,
        transaction: tx
      })
    }
    if (elementERC1155Orders.length > 0) {
      try {
        const tx = await this.orderManager.cancelERC1155Orders(elementERC1155SignedOrders, params)
        succeedTransactions.push({
          orders: elementERC1155Orders,
          transaction: tx
        })
      } catch (e) {
        if (succeedTransactions.length == 0) {
          throw e
        }
      }
    }
    if (succeedTransactions.length == 0) {
      throw Error('cancelOrders failed.')
    }
    return { succeedTransactions: succeedTransactions }
  }
  
  public async cancelAllOrdersForSigner(params?: CancelAllOrdersByMakerParams): Promise<TransactionResponse> {
    if (params?.standard?.toLowerCase() == Standard.ElementEx || !params?.standard) {
      return this.orderManager.cancelAllOrders(params)
    } else {
      throw Error(`cancelAllOrders failed`)
    }
  }
  
  public async queryOrders(query: OrderQuery): Promise<Array<Order>> {
    return await queryOrders(query, this.apiOption)
  }
  
  private toOrderIdList(
    orders: Array<OrderInformation>,
    quantities?: Array<string | number>,
    tokenIds?: Array<string | number>
  ) {
    const list: any[] = []
    for (let i = 0; i < orders.length; i++) {
      let takeCount = 1
      if (quantities?.length && i < quantities?.length) {
        takeCount = Number(quantities[i]) || 1
      }
      
      let tokenId
      if (tokenIds?.length && i < tokenIds.length) {
        tokenId = tokenIds[i]?.toString()
      } else {
        if (
          orders[i].saleKind === SaleKind.ContractOffer ||
          orders[i].saleKind === SaleKind.BatchOfferERC721s
        ) {
          throw Error(`orders[${ i }] error, the collection-based offer requires the \`assetId\``)
        }
      }
      
      list.push({
        orderId: orders[i].orderId,
        takeCount,
        tokenId
      })
    }
    return list
  }
  
  private async makeOrder(params: MakeOrderParams, isBuyOrder: boolean): Promise<OrderInformation> {
    const schema = params.assetSchema || AssetSchema.ERC721
    if (schema.toLowerCase() != 'erc721' && schema.toLowerCase() != 'erc1155') {
      throw Error('makeOrder failed, unsupported schema : ' + schema)
    }
    const assetId = toString(params.assetId) || undefined
    const accountAddress = await this.web3Signer.getCurrentAccount()
    const takerAddress = params.takerAddress ? params.takerAddress.toLowerCase() : NULL_ADDRESS
    
    // 1. query nonce
    const nonce = await queryNonce({
      maker: accountAddress,
      schema: schema,
      count: 1
    }, this.apiOption)
    
    // 2. query oracleSignature flag
    const oracleSignature = await queryOracleSignature(this.apiOption)
    
    // 3. queryFees
    let platformFeePoint, platformFeeAddress, royaltyFeePoint, royaltyFeeAddress
    if (takerAddress === NULL_ADDRESS) {
      const fees = await queryFees([ params.assetAddress ], this.apiOption)
      if (fees.length > 0) {
        platformFeePoint = fees[0].protocolFeePoints
        platformFeeAddress = fees[0].protocolFeeAddress
        royaltyFeePoint = fees[0].royaltyFeePoints
        royaltyFeeAddress = fees[0].royaltyFeeAddress
      }
    }
    
    // 4. create order
    const quantity = params.quantity != null ? toString(params.quantity) : undefined
    const orderParams: CreateOrderParams = {
      makerAddress: accountAddress,
      takerAddress,
      asset: {
        id: assetId,
        address: params.assetAddress,
        schema: schema.toString().toUpperCase()
      },
      quantity: quantity,
      paymentToken: params.paymentToken,
      startTokenAmount: toString(params.paymentTokenAmount),
      platformFeePoint: platformFeePoint,
      platformFeeAddress: platformFeeAddress,
      royaltyFeePoint: royaltyFeePoint,
      royaltyFeeAddress: royaltyFeeAddress,
      listingTime: toNumber(params.listingTime),
      expirationTime: toNumber(params.expirationTime),
      nonce: nonce.toString(),
      saleKind: SaleKind.FixedPrice,
      oracleSignature
    }
    const order = isBuyOrder
      ? await this.orderManager.createBuyOrder(orderParams, params)
      : await this.orderManager.createSellOrder(orderParams, params)
    
    // 4. sign order
    const signedOrder = await this.orderManager.signOrder(order)
    
    // 5. post order
    const request = toOrderRequest(signedOrder)
    const response = await postOrder(request, this.apiOption)
    
    return toOrderInformation(request, response.orderId)
  }
}
