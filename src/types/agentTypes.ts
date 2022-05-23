import { Asset, SaleKind, Signature } from './elementTypes';
import { ERC1155Order, ERC721Order } from '../elementEx/EIP712Orders';

export interface IMakeOrderParams {
    makerAddress: string;
    takerAddress: string;
    asset: Asset;
    quantity?: string | number;
    paymentToken: string;
    startTokenAmount: string | number;
    platformFeePoint: number;
    royaltyFeePoint: number;
    royaltyFeeAddress?: string;
    listingTime?: number;
    expirationTime?: number;
    nonce: string;
    saleKind?: SaleKind;
    endTokenAmount?: string | number;
}

export interface IFillOrderParams {
    order: ERC721Order | ERC1155Order;
    sig: Signature;
    takerAddress: string;
    quantity?: string | number;
    assetId?: string | number;
}
