import { ethers, Signer } from 'ethers'
import { TransactionResponse } from '@ethersproject/abstract-provider'

export const NULL_ADDRESS = '0x0000000000000000000000000000000000000000'
export const ETH_TOKEN_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'

export type SignerOrProvider = Signer | ethers.providers.Web3Provider;

export enum Network {
  ETH = 'eth',
  BSC = 'bsc',
  Polygon = 'polygon',
  Avalanche = 'avalanche',
  Arbitrum = 'arbitrum',
  ZkSync = 'zksync',
  Linea = 'linea',
  Base = 'base',
  OpBNB = 'opbnb',
  Scroll = 'scroll',
  MantaPacific = 'manta_pacific',
  Optimism = 'optimism',
  Mantle = 'mantle',
  ZKFair = 'zkfair',
  Blast = 'blast',
  Merlin = 'merlin',
}

export enum OrderSide {
  BuyOrder = 0,
  SellOrder = 1
}

export enum SaleKind {
  FixedPrice = 0,
  BatchSignedERC721Order = 3,
  ContractOffer = 7,
  BatchOfferERC721s = 8,
}

export enum Standard {
  ElementEx = 'element-ex-v3',
}

export enum Market {
  ElementEx = 'element',
}

export enum AssetSchema {
  ERC721 = 'ERC721',
  ERC1155 = 'ERC1155'
}

export interface Asset {
  assetId: string;
  assetAddress: string;
  assetSchema: AssetSchema;
  quantity: string;
}

export interface ElementAPIConfig {
  networkName: Network;
  apiKey: string;
  signer: SignerOrProvider;
  isTestnet?: boolean;
}

export interface OrderInformation {
  // Asset contract address.
  contractAddress: string;
  // Asset token id
  tokenId: string;
  // Asset schema
  schema: AssetSchema | string;
  // The order trading Standards.
  standard: Standard | string;
  // The order maker's wallet address.
  maker: string;
  // Listing time.
  listingTime: number | string;
  // Expiration time.
  expirationTime: number | string;
  // Priced in paymentToken, and the unit is ether.
  price: number | string;
  // The contract address of the paymentToken.
  paymentToken: string;
  // Kind of sell order. 0 for fixed-price sales, and 3 for batchSignedERC721 sell order.
  saleKind: SaleKind | number | string;
  // Side of the order. 0 for buy order, and 1 for sell order.
  side: OrderSide | number | string;
  // Order id.
  orderId: string;
}

export interface Order extends OrderInformation {
  // The asset quantity of order.
  quantity: string;
  // Priced in the native token(e.g. ETH), and the unit is ether.
  priceBase: number;
  // Priced in USD.
  priceUSD: number;
  // The order taker's wallet address
  taker: string;
  // Additional information
  exchangeData: string;
}

export interface GasParams {
  gasPrice?: string | number;
  maxFeePerGas?: string | number;
  maxPriorityFeePerGas?: string | number;
}

export interface ERC721SellOrderItem {
  erc721TokenId: string | number;
  erc721TokenAddress: string;
  paymentTokenAmount: string | number;
}

export interface MakeERC721SellOrdersParams extends GasParams {
  listingTime?: number;
  expirationTime?: number;
  paymentToken?: string;
  items: Array<ERC721SellOrderItem>
}

export interface FailedERC721Item {
  assetTokenId: string;
  assetContract: string;
  errorDetail: string;
}

export interface MakeERC721SellOrdersResponse {
  succeedList: Array<OrderInformation>;
  failedList: Array<FailedERC721Item>;
}

export interface MakeOrderParams extends GasParams {
  takerAddress?: string;
  assetId?: string | number;
  assetAddress: string;
  assetSchema?: AssetSchema | string;
  quantity?: string | number;
  paymentToken?: string;
  paymentTokenAmount: string | number;
  listingTime?: number;
  expirationTime?: number;
}

export interface FillOrderParams extends GasParams {
  order: OrderInformation;
  quantity?: string | number;
  assetId?: string | number;
}

export interface BatchBuyWithETHParams extends GasParams {
  orders: Array<OrderInformation>;
  quantities?: Array<string | number>;
}

export interface EncodeTradeDataParams {
  orders: Array<OrderInformation>;
  quantities?: Array<string | number>;
  tokenIds?: Array<string | number>;
  taker?: string;
}

export interface TradeData {
  toContract: string;
  payableValue: string;
  data: string;
  flags: Array<boolean>;
}

export interface CancelOrderParams extends GasParams {
  order: Order;
}

export interface CancelOrdersParams extends GasParams {
  orders: Array<Order>;
}

export interface CancelOrdersTransaction {
  orders: Array<Order>;
  transaction: TransactionResponse;
}

export interface CancelOrdersResponse {
  succeedTransactions: Array<CancelOrdersTransaction>;
}

export interface CancelAllOrdersByMakerParams extends GasParams {
  standard?: Standard;
}
