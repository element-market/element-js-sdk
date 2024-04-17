export interface OrderItem {
  erc20TokenAmount: string;
  nftId: string;
}

export interface Collection {
  nftAddress: string;
  platformFee: number;
  royaltyFeeRecipient: string;
  royaltyFee: number;
  items: OrderItem[];
}

export interface BatchSignedERC721Order {
  exchange: string;
  maker: string;
  listingTime: number;
  expirationTime: number;
  startNonce: number;
  paymentToken: string;
  platformFeeRecipient: string;
  basicCollections: Collection[];
  collections: Collection[];
  hashNonce: string;
  oracleSignature: number;
  chain: string;
}

export interface BatchSignedERC721OrderRequest extends BatchSignedERC721Order {
  v: number;
  r: string;
  s: string;
  hash: string;
}

export interface BatchSignedERC721OrderResponse extends BatchSignedERC721OrderRequest {
  nonce: number;
}
