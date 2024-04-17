import { LimitedCallSpec, Web3Signer } from '../../signer/Web3Signer'
import { getElementExContract, getHelperContract } from '../../contracts/contracts'
import { CONTRACTS_ADDRESSES } from '../../contracts/config'
import { BigNumber } from 'ethers'
import {
  CreateOrderParams,
  DEFAULT_EXPIRATION_TIME,
  ERC1155Order,
  ERC721Order,
  Fee,
  MAX_EXPIRATION_TIME,
  MAX_LISTING_TIME,
  SignatureType,
  SignedOrder
} from './orderTypes'
import { AssetSchema, ETH_TOKEN_ADDRESS, GasParams, NULL_ADDRESS, SaleKind } from '../../types/types'
import { toContractERC20Token } from '../../util/tokenUtil'
import { getOrderTypedData } from './orderTypedData'
import { encodeBits } from '../../util/bitsUtil'
import { TransactionResponse } from '@ethersproject/abstract-provider'

export class OrderManager {
  
  public web3Signer: Web3Signer
  public WETH: string
  
  constructor(web3Signer: Web3Signer) {
    this.web3Signer = web3Signer
    this.WETH = CONTRACTS_ADDRESSES[web3Signer.chainId].WToken
  }
  
  public async cancelERC721Orders(signedOrders: any[], gasParams: GasParams): Promise<TransactionResponse> {
    const nonces: any [] = []
    for (const signedOrder of signedOrders) {
      nonces.push(signedOrder.order ? signedOrder.order.nonce : signedOrder.nonce)
    }
    
    const elementEx = await this.getElementEx()
    const tx = await elementEx.populateTransaction.batchCancelERC721Orders(nonces)
    if (!tx?.data) {
      throw Error('cancelOrder failed, populateTransaction error.')
    }
    const from = await this.web3Signer.getCurrentAccount()
    const call: LimitedCallSpec = {
      from: from,
      to: elementEx.address,
      data: tx.data,
      gasPrice: gasParams.gasPrice,
      maxPriorityFeePerGas: gasParams.maxPriorityFeePerGas,
      maxFeePerGas: gasParams.maxFeePerGas
    }
    return this.web3Signer.ethSend(call)
  }
  
  public async createSellOrder(params: CreateOrderParams, gasParams: GasParams): Promise<ERC721Order | ERC1155Order> {
    const expiry = getOrderExpiry(params)
    const fees = calcFees(params)
    const erc20TokenAmount = calcERC20TokenAmount(params, fees)
    const order: any = {
      maker: params.makerAddress.toLowerCase(),
      taker: params.takerAddress.toLowerCase(),
      expiry: expiry,
      nonce: BigNumber.from(params.nonce).toString(),
      erc20Token: toContractERC20Token(params.paymentToken),
      erc20TokenAmount: erc20TokenAmount,
      fees: fees
    }
    
    switch (params.asset.schema) {
      case AssetSchema.ERC721:
        order.nft = params.asset.address.toLowerCase()
        order.nftId = BigNumber.from(params.asset.id).toString()
        break
      case AssetSchema.ERC1155:
        order.erc1155Token = params.asset.address.toLowerCase()
        order.erc1155TokenId = BigNumber.from(params.asset.id).toString()
        order.erc1155TokenAmount = BigNumber.from(params.quantity).toString()
        break
      default:
        throw Error('createSellOrder failed, unsupported schema : ' + params.asset.schema)
    }
    await this.checkAndApproveSellOrder(order, gasParams)
    return order
  }
  
  public async createBuyOrder(params: CreateOrderParams, gasParams: GasParams): Promise<ERC721Order | ERC1155Order> {
    const expiry = getOrderExpiry(params)
    const fees = calcFees(params)
    const erc20TokenAmount = calcERC20TokenAmount(params, fees)
    const paymentToken = params.paymentToken ? params.paymentToken : this.WETH
    
    const order: any = {
      maker: params.makerAddress.toLowerCase(),
      taker: params.takerAddress.toLowerCase(),
      expiry: expiry,
      nonce: BigNumber.from(params.nonce).toString(),
      erc20Token: toContractERC20Token(paymentToken),
      erc20TokenAmount: erc20TokenAmount,
      fees: fees
    }
    
    const { tokenId, properties } = getBuyOrderTokenIdAndProperties(params)
    switch (params.asset.schema) {
      case AssetSchema.ERC721:
        order.nft = params.asset.address.toLowerCase()
        order.nftId = tokenId
        order.nftProperties = properties
        break
      case AssetSchema.ERC1155:
        order.erc1155Token = params.asset.address.toLowerCase()
        order.erc1155TokenId = tokenId
        order.erc1155TokenAmount = BigNumber.from(params.quantity).toString()
        order.erc1155TokenProperties = properties
        break
      default:
        throw Error('createBuyOrder failed, unsupported schema : ' + params.asset.schema)
    }
    
    await this.checkAndApproveBuyOrder(order, gasParams)
    return order
  }
  
  public async signOrder(order: any): Promise<SignedOrder> {
    const chainId = this.web3Signer.chainId
    const typedData = getOrderTypedData(order, chainId)
    const signature = await this.web3Signer.signTypedData(order.maker, typedData)
    const orderHash = Web3Signer.getOrderHash(typedData)
    return {
      chainId: chainId,
      order: order,
      signature: {
        signatureType: SignatureType.EIP712,
        v: signature.v,
        r: signature.r,
        s: signature.s
      },
      orderHash: orderHash
    }
  }
  
  public async cancelERC1155Orders(signedOrders: any[], gasParams: GasParams): Promise<TransactionResponse> {
    const nonces: any [] = []
    for (const signedOrder of signedOrders) {
      nonces.push(signedOrder.order.nonce)
    }
    
    const elementEx = await this.getElementEx()
    const tx = await elementEx.populateTransaction.batchCancelERC1155Orders(nonces)
    if (!tx?.data) {
      throw Error('cancelOrder failed, populateTransaction error.')
    }
    const from = await this.web3Signer.getCurrentAccount()
    const call: LimitedCallSpec = {
      from: from,
      to: elementEx.address,
      data: tx.data,
      gasPrice: gasParams.gasPrice,
      maxPriorityFeePerGas: gasParams.maxPriorityFeePerGas,
      maxFeePerGas: gasParams.maxFeePerGas
    }
    return this.web3Signer.ethSend(call)
  }
  
  public async cancelAllOrders(gasParams?: GasParams): Promise<TransactionResponse> {
    const elementEx = await this.getElementEx()
    const tx = await elementEx.populateTransaction.incrementHashNonce()
    if (!tx?.data) {
      throw Error('cancelAllOrders failed, populateTransaction error.')
    }
    
    const from = await this.web3Signer.getCurrentAccount()
    const call: LimitedCallSpec = {
      from: from,
      to: elementEx.address,
      data: tx.data,
      gasPrice: gasParams?.gasPrice,
      maxPriorityFeePerGas: gasParams?.maxPriorityFeePerGas,
      maxFeePerGas: gasParams?.maxFeePerGas
    }
    return this.web3Signer.ethSend(call)
  }
  
  private async getElementEx() {
    const signer = await this.web3Signer.getSigner()
    return getElementExContract(this.web3Signer.chainId, signer)
  }
  
  private async getHelper() {
    const signer = await this.web3Signer.getSigner()
    return getHelperContract(this.web3Signer.chainId, signer)
  }
  
  private async checkAndApproveSellOrder(order: ERC721Order | ERC1155Order, gasParams: GasParams) {
    const isERC721Order = order['nft'] != null
    const helper = await this.getHelper()
    const elementEx = await this.getElementEx()
    const r = isERC721Order
      ? await helper.checkERC721SellOrder(order, NULL_ADDRESS)
      : await helper.checkERC1155SellOrder(order, NULL_ADDRESS, '0')
    
    order.hashNonce = r.info?.hashNonce?.toString()
    if (r.info.success) {
      return
    }
    if (!r.info.makerCheck) {
      throw Error('createSellOrder failed, makerCheck error.')
    }
    if (!r.info.takerCheck) {
      throw Error('createSellOrder failed, takerCheck error.')
    }
    if (!r.info.listingTimeCheck) {
      throw Error('createSellOrder failed, listingTimeCheck error.')
    }
    if (!r.info.expireTimeCheck) {
      throw Error('createSellOrder failed, expireTimeCheck error.')
    }
    if (!r.info.extraCheck) {
      throw Error('createSellOrder failed, extraCheck error.')
    }
    if (!r.info.feesCheck) {
      throw Error('createSellOrder failed, feesCheck error.')
    }
    if (!r.info.nonceCheck) {
      throw Error('createSellOrder failed, nonceCheck error, please try again.')
    }
    if (!r.info.erc20AddressCheck) {
      throw Error('createSellOrder failed, erc20AddressCheck error.')
    }
    if (isERC721Order) {
      if (!r.info.erc721OwnerCheck) {
        throw Error(`createSellOrder, erc721OwnerCheck failed, make sure account(${ order.maker }) is owner of assetId(${ order['nftId'] }).`)
      }
      if (!r.info.erc721ApprovedCheck) {
        console.log('start approveERC721, ERC721Address =', order['nft'])
        const tx = await this.web3Signer.approveERC721Proxy(order.maker, order['nft'], elementEx.address, gasParams)
        console.log('approveERC721, tx.hash', tx.hash)
        await tx.wait()
        console.log('approveERC721, completed.')
      }
    } else {
      if (order['erc1155TokenAmount'] == null || BigNumber.from(order['erc1155TokenAmount']).lt('1')) {
        throw Error('createSellOrder, quantityCheck failed, erc1155 should set quantity.')
      }
      if (!r.info.remainingAmountCheck) {
        throw Error('createSellOrder, remainingAmountCheck failed, please try again.')
      }
      if (!r.info.erc1155BalanceCheck) {
        throw Error(`createSellOrder, erc1155BalanceCheck failed, account(${ order.maker }), require erc1155Balance >= quantity`)
      }
      if (!r.info.erc1155ApprovedCheck) {
        console.log('start approveERC1155, ERC1155Address =', order['erc1155Token'])
        const tx = await this.web3Signer.approveERC1155Proxy(order.maker, order['erc1155Token'], elementEx.address, gasParams)
        console.log('approveERC1155, tx.hash', tx.hash)
        await tx.wait()
        console.log('approveERC1155, completed.')
      }
    }
  }
  
  private async checkAndApproveBuyOrder(order: ERC721Order | ERC1155Order, gasParams: GasParams) {
    const isERC721Order = order['nft'] != null
    const helper = await this.getHelper()
    const elementEx = await this.getElementEx()
    const r = isERC721Order
      ? await helper.checkERC721BuyOrder(order, NULL_ADDRESS, '0')
      : await helper.checkERC1155BuyOrder(order, NULL_ADDRESS, '0', '0')
    
    order.hashNonce = r.info?.hashNonce?.toString()
    if (r.info.success) {
      return
    }
    if (!r.info.makerCheck) {
      throw Error('createBuyOrder, makerCheck failed.')
    }
    if (!r.info.takerCheck) {
      throw Error('createBuyOrder, takerCheck failed.')
    }
    if (!r.info.listingTimeCheck) {
      throw Error('createBuyOrder, listingTimeCheck failed.')
    }
    if (!r.info.expireTimeCheck) {
      throw Error('createBuyOrder, expireTimeCheck failed.')
    }
    if (!r.info.feesCheck) {
      throw Error('createBuyOrder, feesCheck failed.')
    }
    if (!r.info.nonceCheck) {
      throw Error('createBuyOrder, nonceCheck failed, please try again.')
    }
    if (!r.info.erc20AddressCheck) {
      throw Error('createBuyOrder, erc20AddressCheck failed, should be ERC20 address, can not be native address.')
    }
    if (!r.info.propertiesCheck) {
      throw Error('createBuyOrder, propertiesCheck failed.')
    }
    if (!isERC721Order) {
      if (order['erc1155TokenAmount'] == null || BigNumber.from(order['erc1155TokenAmount']).lt('1')) {
        throw Error('createBuyOrder, quantityCheck failed, quantity: ' + order['erc1155TokenAmount'])
      }
      if (!r.info.remainingAmountCheck) {
        throw Error('createBuyOrder, remainingAmountCheck failed, please try again.')
      }
    }
    if (!r.info.erc20BalanceCheck) {
      throw Error(`createBuyOrder, erc20BalanceCheck failed, make sure account${ order.maker } have enough balance of erc20Token(${ order.erc20Token }).`)
    }
    if (!r.info.erc20AllowanceCheck && order.erc20Token.toLowerCase() != ETH_TOKEN_ADDRESS) {
      console.log('start approveERC20, ERC20Address =', order.erc20Token)
      const tx = await this.web3Signer.approveERC20Proxy(order.maker, order.erc20Token, elementEx.address, gasParams)
      console.log('approveERC20, tx.hash', tx.hash)
      await tx.wait(1)
      console.log('approveERC20, completed.')
    }
  }
}

function calcFees(params: CreateOrderParams): Fee[] {
  const fees: Fee[] = []
  const totalAmount = BigNumber.from(params.startTokenAmount)
  if (params.platformFeePoint && params.platformFeeAddress) {
    fees.push({
      recipient: params.platformFeeAddress,
      amount: totalAmount.mul(params.platformFeePoint).div(10000).toString(),
      feeData: '0x'
    })
  }
  if (params.royaltyFeePoint && params.royaltyFeeAddress) {
    fees.push({
      recipient: params.royaltyFeeAddress,
      amount: totalAmount.mul(params.royaltyFeePoint).div(10000).toString(),
      feeData: '0x'
    })
  }
  return fees
}

function calcERC20TokenAmount(params: CreateOrderParams, fees: Fee[]): string {
  let amount = BigNumber.from(params.startTokenAmount)
  for (const fee of fees) {
    amount = amount.sub(fee.amount)
  }
  return amount.toString()
}

function getOrderExpiry(params: CreateOrderParams): string {
  if (params.saleKind == null || params.saleKind == SaleKind.FixedPrice) {
    const { listingTime, expirationTime } = getOrderTimeOfFixedPrice(params)
    // saleKind (4bit) + oracleSignature(4bit) + reserved(152bit) + extra(32bit) + listingTime(32bit) + expiryTime(32bit) = 256bit
    return encodeBits([
      [ 0, 4 ],
      [ params.oracleSignature, 4 ],
      [ 0, 152 ],
      [ 0, 32 ],
      [ listingTime, 32 ],
      [ expirationTime, 32 ]
    ])
  }
  throw Error('createOrder failed, unsupported saleKind : ' + params.saleKind)
}

function getOrderTimeOfFixedPrice(params: CreateOrderParams) {
  const now = Math.floor(Date.now() / 1000)
  
  let listingTime
  if (params.listingTime) {
    listingTime = params.listingTime
    if (listingTime > now + MAX_LISTING_TIME) {
      throw Error('makeOrder failed, require listingTime <= now + 1 year.')
    }
    if (listingTime < (now - 1800)) {
      throw Error('makeOrder failed, listingTime >= now - 30 minute.')
    }
  } else {
    listingTime = now - 60
  }
  
  let expirationTime
  if (params.expirationTime != null) {
    expirationTime = params.expirationTime
    if (expirationTime < Math.max(listingTime, now)) {
      throw Error('makeOrder failed, require expirationTime >= Math.max(listingTime, now).')
    }
    if (expirationTime > Math.max(listingTime, now) + MAX_EXPIRATION_TIME) {
      throw Error('makeOrder failed, require expirationTime <= Math.max(listingTime, now) + 1 year.')
    }
  } else {
    expirationTime = Math.max(listingTime, now) + DEFAULT_EXPIRATION_TIME
  }
  return { listingTime, expirationTime }
}

function getBuyOrderTokenIdAndProperties(params: CreateOrderParams) {
  if (params.asset.id == null) {
    return {
      tokenId: '0',
      properties: [ {
        propertyValidator: NULL_ADDRESS,
        propertyData: '0x'
      } ]
    }
  } else {
    return {
      tokenId: BigNumber.from(params.asset.id).toString(),
      properties: []
    }
  }
}
