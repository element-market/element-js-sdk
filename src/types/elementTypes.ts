import { Fee, Property } from "../elementEx/EIP712Orders";

export enum OrderSide {
    BuyOrder = 0,
    SellOrder = 1
}

export enum SaleKind {
    FixedPrice,
    DutchAuction,
    EnglishAuction
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

export enum AssetSchema {
    ERC721 = 'ERC721',
    ERC1155 = 'ERC1155'
}

export interface Asset {
    id?: string | number;
    address: string;
    schema?: AssetSchema;
}

export interface AssetRequest {
    id: string;
    address: string;
}

export interface Metadata {
    asset: AssetRequest;
    schema: AssetSchema;
}

export interface BaseOrder {
    exchange: string;
    chain: string;
    maker: string;
    taker: string;
    side: OrderSide;
    saleKind: SaleKind;
    paymentToken: string;
    quantity: string | number;
    basePrice: string | number;
    extra: string | number;
    listingTime: string | number;
    expirationTime: string | number;
    fees: Fee[];
    properties?: Property[];
    nonce: string | number;
    hashNonce: string | number;
    signatureType: number;
    v: SignatureType;
    r: string;
    s: string;
    hash?: string;
}

export interface OrderRequest extends BaseOrder {
    metadata: Metadata;
}

export interface OrderResponse extends BaseOrder {
    "assetContract": string;
    "assetTokenId": string | number;
    "schema": string;
}
