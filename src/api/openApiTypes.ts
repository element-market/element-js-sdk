import { OrderSide, SaleKind } from '../types/types'

export const API_HOST = 'https://api.element.market'
export const API_HOST_TESTNET = 'https://api-test.element.market'
export const TIME_OUT = 10000

export interface ApiOption {
    chain: string;
    isTestnet: boolean;
    apiKey: string;
}

export interface NonceQuery {
    // The order maker's wallet address
    maker: string;
    // Schema eg. erc721, erc1155
    schema: string;
    // The number of nonces occupied this time, The default is 1.
    // for example: count is 5, and the returned data is 4, then
    // the nonce equivalent to [4,4+5-1] is this request.
    count: number;
}

export interface Fees {
    contractAddress: string;
    protocolFeePoints: number;
    protocolFeeAddress: string;
    royaltyFeePoints: number;
    royaltyFeeAddress: string;
}

export interface OrderQuery {
    // Filter by smart contract address for the asset category.
    asset_contract_address?: string;
    // Filter by a list of token IDs for the order's asset, comma separated. Needs to be defined together with asset_contract_address.
    token_ids?: Array<string | number>;
    // Filter by the kind of sell order. 0 for fixed-price sales, 1 for declining-price Dutch Auctions, 2 for English Auctions
    sale_kind?: SaleKind;
    // Filter by the side of the order. 0 for buy orders and 1 for sell orders.
    side?: OrderSide;
    // Filter by the order maker's wallet address
    maker?: string;
    // Filter by the order maker's wallet address
    taker?: string;
    // Filter by the address of the smart contract of the payment token that is accepted
    // or offered by the order, Eth and other primary chain currencies are 0x0000000000000000000000000000000000000000
    payment_token?: string;
    // How to sort the orders. Can be `created_date` for when they were made,
    // or `base_price` to see the lowest-priced orders first.
    // when using 1created_date1, the results are sorted by listingTime.
    // use with direction, created_date is default.
    order_by?: string;
    // Can be asc or desc for ascending or descending sort. Default value : desc
    direction?: string;
    // Only show orders listed before this timestamp. Seconds since the Unix epoch.
    listed_before?: number | string;
    // Only show orders listed after this timestamp. Seconds since the Unix epoch.
    listed_after?: number | string;
    // Number of orders to return (capped at 50, default is 20). Default value: 20
    limit?: number;
    // Number of orders to offset by (for pagination). Default value: 0
    offset?: number;
}
