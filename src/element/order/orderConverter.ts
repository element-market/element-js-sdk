import { BigNumber, ethers } from 'ethers'
import { ERC1155Order, ERC721Order, Fee, OrderRequest, Property, SignedOrder } from './orderTypes'
import { getChain } from '../../util/chainUtil'
import { CONTRACTS_ADDRESSES } from '../../contracts/config'
import { AssetSchema, OrderInformation, OrderSide, SaleKind, Standard } from '../../types/types'
import { encodeBits } from '../../util/bitsUtil'
import { toStandardERC20Token } from '../../util/tokenUtil'

export function toOrderInformation(order: OrderRequest, orderId: string): OrderInformation {
  let price = order.basePrice
  if (order.quantity) {
    price = BigNumber.from(order.basePrice).div(order.quantity).toString()
  }
  return {
    contractAddress: order.metadata.asset.address,
    tokenId: order.metadata.asset.id,
    schema: order.metadata.schema,
    standard: Standard.ElementEx,
    maker: order.maker,
    listingTime: Number(order.listingTime),
    expirationTime: Number(order.expirationTime),
    price: Number(ethers.utils.formatEther(price)),
    paymentToken: order.paymentToken,
    saleKind: order.saleKind,
    side: order.side,
    orderId
  }
}

export function toOrderRequest(signedOrder: SignedOrder): OrderRequest {
  const { order, signature, chainId } = signedOrder
  const chain = getChain(chainId)
  const exchange = CONTRACTS_ADDRESSES[chainId].ElementEx
  
  const info = parseOrder(order)
  const expiry = decodeExpiry(order.expiry)
  const totalERC20Amount = calcTotalERC20Amount(order)
  const paymentToken = toStandardERC20Token(order.erc20Token)
  
  const request: OrderRequest = {
    exchange: exchange.toLowerCase(),
    maker: order.maker.toLowerCase(),
    taker: order.taker.toLowerCase(),
    side: info.side,
    saleKind: expiry.saleKind,
    oracleSignature: expiry.oracleSignature,
    paymentToken: paymentToken,
    quantity: info.quantity,
    basePrice: totalERC20Amount,
    extra: expiry.extra,
    listingTime: expiry.listingTime,
    expirationTime: expiry.expirationTime,
    metadata: info.metadata,
    fees: toLowerCaseFees(order.fees),
    nonce: order.nonce,
    hashNonce: order.hashNonce,
    hash: signedOrder.orderHash,
    signatureType: signature.signatureType,
    v: signature.v,
    r: signature.r,
    s: signature.s,
    chain: chain
  }
  if (info.properties != null) {
    request.properties = toLowerCaseProperties(info.properties)
    if (request.properties.length > 0) {
      request.saleKind = SaleKind.ContractOffer
    }
  }
  return request
}

function toLowerCaseFees(fees: Fee[]): Fee[] {
  return fees.map(fee => ({
    recipient: fee.recipient.toLowerCase(),
    amount: BigNumber.from(fee.amount).toString(),
    feeData: fee.feeData
  }))
}

function toLowerCaseProperties(properties: Property[]): Property[] {
  return properties.map(property => ({
    propertyValidator: property.propertyValidator.toLowerCase(),
    propertyData: property.propertyData
  }))
}

function calcTotalERC20Amount(order: ERC721Order | ERC1155Order): string {
  let total = BigNumber.from(order.erc20TokenAmount)
  for (let i = 0; i < order.fees.length; i++) {
    total = total.add(order.fees[i].amount)
  }
  return total.toString()
}

function parseOrder(order: ERC721Order | ERC1155Order) {
  let side: OrderSide
  let quantity: string
  let metadata
  let properties
  if (order['nft'] != undefined) {
    quantity = '1'
    metadata = {
      asset: {
        id: order['nftId'],
        address: order['nft'].toString().toLowerCase()
      },
      schema: AssetSchema.ERC721
    }
    
    if (order['nftProperties'] != undefined) {
      side = OrderSide.BuyOrder
      properties = toLowerCaseProperties(order['nftProperties'])
    } else {
      side = OrderSide.SellOrder
      properties = undefined
    }
  } else if (order['erc1155Token'] != undefined) {
    quantity = order['erc1155TokenAmount']
    metadata = {
      asset: {
        id: order['erc1155TokenId'],
        address: order['erc1155Token'].toString().toLowerCase()
      },
      schema: AssetSchema.ERC1155
    }
    
    if (order['erc1155TokenProperties'] != undefined) {
      side = OrderSide.BuyOrder
      properties = toLowerCaseProperties(order['erc1155TokenProperties'])
    } else {
      side = OrderSide.SellOrder
      properties = undefined
    }
  } else {
    throw Error('toOrderStr error')
  }
  return { side, quantity, metadata, properties }
}

function decodeExpiry(expiry: string) {
  // saleKind (4bit) + reserved(156bit) + extra(32bit) + listingTime(32bit) + expiryTime(32bit) = 256bit
  const hex = encodeBits([ [ expiry, 256 ] ]).substring(2)
  const orderSaleKindHex = '0x' + hex.substring(0, 1)
  const oracleSignatureHex = '0x' + hex.substring(1, 2)
  const extraHex = '0x' + hex.substring(40, 48)
  const listingTimeHex = '0x' + hex.substring(48, 56)
  const expiryTimeHex = '0x' + hex.substring(56, 64)
  return {
    saleKind: parseInt(orderSaleKindHex),
    oracleSignature: parseInt(oracleSignatureHex),
    extra: parseInt(extraHex).toString(),
    listingTime: parseInt(listingTimeHex),
    expirationTime: parseInt(expiryTimeHex)
  }
}
