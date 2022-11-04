import { AssetSchema, OrderSide, SaleKind } from '../types/types'

export interface TradeDetails {
    marketId: string | number;
    value: string;
    data: string
}

export interface SwapTradeData extends TradeDetails {
    // Standard.
    standard: string;
    // Payment Token.
    paymentToken: string;
    // Maker address.
    maker: string;
    // Order listing time.
    listingTime: number;
    // Order side.
    side: OrderSide;
    // Order sale kind, 0 for ordinary order, 3 for bulk shelves, 7 for collection offer.
    saleKind: SaleKind;
    // Asset contract address.
    contractAddress: string;
    // Asset token id.
    tokenId: string;
    // Schema.
    schema: AssetSchema;
    // Contract called address.
    toAddress: string;
    // Order exchange data.
    exchangeData: string;
    // Order hash.
    orderHash: string;
    // Order exchange data.
    errorDetail: string;
    // Order price, the unit is ether.
    price: number;
}
