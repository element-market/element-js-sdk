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

/// @param data1 [56 bits(startNonce) + 8 bits(v) + 32 bits(listingTime) + 160 bits(maker)]
/// @param data2 [64 bits(taker part1) + 32 bits(expiryTime) + 160 bits(erc20Token)]
/// @param data3 [96 bits(taker part2) + 160 bits(platformFeeRecipient)]
export interface BatchSignedERC721OrderParameter {
    data1: string;
    data2: string;
    data3: string;
    r: string;
    s: string;
}

/// @param data1 [56 bits(startNonce) + 8 bits(v) + 32 bits(listingTime) + 160 bits(maker)]
/// @param data2 [64 bits(taker part1) + 32 bits(expiryTime) + 160 bits(erc20Token)]
/// @param data3 [96 bits(taker part2) + 160 bits(platformFeeRecipient)]
export interface BatchSignedERC721OrderParameters {
    data1: string;
    data2: string;
    data3: string;
    r: string;
    s: string;
    collections: string;
}

export interface CollectionsBytesList {
    value: string;
    royaltyFeeStat: Map<string, number>;
    bytesList: string[];
}
