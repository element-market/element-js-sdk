import { AssetSchema, OrderSide, SaleKind } from '../../types/types'

export const DEFAULT_EXPIRATION_TIME = (7 * 86400)
export const MAX_EXPIRATION_TIME = (365 * 86400)
export const MAX_LISTING_TIME = (365 * 86400)

export interface Fee {
  recipient: string;
  amount: string;
  feeData: string;
}

export interface Property {
  propertyValidator: string;
  propertyData: string;
}

export enum SignatureType {
  EIP712,
  PRESIGNED
}

export interface Signature {
  signatureType: SignatureType;
  v: number;
  r: string;
  s: string;
}

export interface ERC721Order {
  maker: string;
  taker: string;
  expiry: string;
  nonce: string;
  erc20Token: string;
  erc20TokenAmount: string;
  fees: Fee[];
  nft: string;
  nftId: string;
  nftProperties?: Property[];
  hashNonce: string;
}

export interface ERC1155Order {
  maker: string;
  taker: string;
  expiry: string;
  nonce: string;
  erc20Token: string;
  erc20TokenAmount: string;
  fees: Fee[];
  erc1155Token: string;
  erc1155TokenId: string;
  erc1155TokenAmount: string;
  erc1155TokenProperties?: Property[];
  hashNonce: string;
}

export interface SignedOrder {
  chainId: number;
  order: ERC721Order | ERC1155Order;
  signature: Signature;
  orderHash: string;
}

export interface AssetRequest {
  id: string;
  address: string;
}

export interface Metadata {
  asset: AssetRequest;
  schema: AssetSchema;
}

export interface OrderRequest {
  exchange: string;
  chain: string;
  maker: string;
  taker: string;
  side: OrderSide;
  saleKind: SaleKind;
  oracleSignature: number;
  paymentToken: string;
  quantity: string;
  basePrice: string | number;
  extra: string | number;
  listingTime: number;
  expirationTime: number;
  metadata: Metadata;
  fees: Fee[];
  properties?: Property[];
  nonce: string | number;
  hashNonce: string | number;
  signatureType: SignatureType;
  v: number;
  r: string;
  s: string;
  hash: string;
}

export interface CreateOrderParams {
  makerAddress: string;
  takerAddress: string;
  asset: {
    id?: string;
    address: string;
    schema: AssetSchema | string;
  };
  quantity?: string;
  paymentToken?: string;
  startTokenAmount: string;
  platformFeePoint: number;
  platformFeeAddress?: string;
  royaltyFeePoint: number;
  royaltyFeeAddress?: string;
  listingTime?: number;
  expirationTime?: number;
  nonce: string;
  saleKind?: SaleKind;
  oracleSignature: number;
}
