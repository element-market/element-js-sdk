import { ERC1155Order, ERC721Order } from './orderTypes'
import { CONTRACTS_ADDRESSES } from '../../contracts/config'

const FEE_ABI = [
  { type: 'address', name: 'recipient' },
  { type: 'uint256', name: 'amount' },
  { type: 'bytes', name: 'feeData' }
]
const PROPERTY_ABI = [
  { type: 'address', name: 'propertyValidator' },
  { type: 'bytes', name: 'propertyData' }
]

// ERC721Order EIP712 information
const STRUCT_ERC721_SELL_ORDER_ABI = [
  { type: 'address', name: 'maker' },
  { type: 'address', name: 'taker' },
  { type: 'uint256', name: 'expiry' },
  { type: 'uint256', name: 'nonce' },
  { type: 'address', name: 'erc20Token' },
  { type: 'uint256', name: 'erc20TokenAmount' },
  { type: 'Fee[]', name: 'fees' },
  { type: 'address', name: 'nft' },
  { type: 'uint256', name: 'nftId' },
  { type: 'uint256', name: 'hashNonce' }
]
const STRUCT_ERC721_BUY_ORDER_ABI = [
  { type: 'address', name: 'maker' },
  { type: 'address', name: 'taker' },
  { type: 'uint256', name: 'expiry' },
  { type: 'uint256', name: 'nonce' },
  { type: 'address', name: 'erc20Token' },
  { type: 'uint256', name: 'erc20TokenAmount' },
  { type: 'Fee[]', name: 'fees' },
  { type: 'address', name: 'nft' },
  { type: 'uint256', name: 'nftId' },
  { type: 'Property[]', name: 'nftProperties' },
  { type: 'uint256', name: 'hashNonce' }
]

// ERC1155Order EIP712 information
const STRUCT_ERC1155_SELL_ORDER_ABI = [
  { type: 'address', name: 'maker' },
  { type: 'address', name: 'taker' },
  { type: 'uint256', name: 'expiry' },
  { type: 'uint256', name: 'nonce' },
  { type: 'address', name: 'erc20Token' },
  { type: 'uint256', name: 'erc20TokenAmount' },
  { type: 'Fee[]', name: 'fees' },
  { type: 'address', name: 'erc1155Token' },
  { type: 'uint256', name: 'erc1155TokenId' },
  { type: 'uint128', name: 'erc1155TokenAmount' },
  { type: 'uint256', name: 'hashNonce' }
]
const STRUCT_ERC1155_BUY_ORDER_ABI = [
  { type: 'address', name: 'maker' },
  { type: 'address', name: 'taker' },
  { type: 'uint256', name: 'expiry' },
  { type: 'uint256', name: 'nonce' },
  { type: 'address', name: 'erc20Token' },
  { type: 'uint256', name: 'erc20TokenAmount' },
  { type: 'Fee[]', name: 'fees' },
  { type: 'address', name: 'erc1155Token' },
  { type: 'uint256', name: 'erc1155TokenId' },
  { type: 'Property[]', name: 'erc1155TokenProperties' },
  { type: 'uint128', name: 'erc1155TokenAmount' },
  { type: 'uint256', name: 'hashNonce' }
]

export function getOrderTypedData(order: ERC721Order | ERC1155Order, chainId: number) {
  if (order['nft'] != undefined) {
    return getERC721TypedData(order as ERC721Order, chainId)
  } else {
    return getERC1155TypedData(order as ERC1155Order, chainId)
  }
}

function getERC721TypedData(order: ERC721Order, chainId: number) {
  if (order.nftProperties == null) {
    // ERC721SellOrder
    return {
      types: {
        ['NFTSellOrder']: STRUCT_ERC721_SELL_ORDER_ABI,
        ['Fee']: FEE_ABI
      },
      domain: getDomain(chainId),
      primaryType: 'NFTSellOrder',
      message: order as any
    }
  } else {
    // ERC721BuyOrder
    return {
      types: {
        ['NFTBuyOrder']: STRUCT_ERC721_BUY_ORDER_ABI,
        ['Fee']: FEE_ABI,
        ['Property']: PROPERTY_ABI
      },
      domain: getDomain(chainId),
      primaryType: 'NFTBuyOrder',
      message: order as any
    }
  }
}

function getERC1155TypedData(order: ERC1155Order, chainId: number) {
  if (order.erc1155TokenProperties == undefined) {
    // ERC1155SellOrder
    return {
      types: {
        ['ERC1155SellOrder']: STRUCT_ERC1155_SELL_ORDER_ABI,
        ['Fee']: FEE_ABI
      },
      domain: getDomain(chainId),
      primaryType: 'ERC1155SellOrder',
      message: order as any
    }
  } else {
    // ERC1155BuyOrder
    return {
      types: {
        ['ERC1155BuyOrder']: STRUCT_ERC1155_BUY_ORDER_ABI,
        ['Fee']: FEE_ABI,
        ['Property']: PROPERTY_ABI
      },
      domain: getDomain(chainId),
      primaryType: 'ERC1155BuyOrder',
      message: order as any
    }
  }
}

function getDomain(chainId: number) {
  return {
    name: 'ElementEx',
    version: '1.0.0',
    chainId: chainId,
    verifyingContract: CONTRACTS_ADDRESSES[chainId].ElementEx.toLowerCase()
  }
}
