import axios from 'axios';
import { OrderSide, OrderRequest, OrderResponse, SaleKind } from '../types/elementTypes';
import BigNumber from 'bignumber.js';

const API_HOST = "https://api.element.market";
const API_HOST_TESTNET = "https://api-test.element.market";
const TIME_OUT = 15000;

export interface ApiOption {
    chain: string;
    isMainnet: boolean;
    apiKey: string;
}

export interface PaymentTokens {
    name: string;
    address: string;
}

export interface Collection {
    platformFeePoint: number;
    royaltyFeePoint: number;
    royaltyFeeAddress?: string;
    paymentTokens: PaymentTokens[];
}

export interface NonceQuery {
    // The order maker's wallet address
    maker: string;
    // Trading contract address.
    exchange: string;
    // Schema eg. erc721, erc1155
    schema: string;
}

export interface OrderQuery {
    // Filter by smart contract address for the asset category.
    asset_contract_address?: string;
    token_id?: string | number;
    // Filter by a list of token IDs for the order's asset, Needs to be defined together with asset_contract_address.
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
    // How to sort the orders. Can be created_date for when they were made,
    // or eth_price to see the lowest-priced orders first (converted to their ETH values).
    // eth_price is only supported when asset_contract_address and token_id are also defined.
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

export interface OrderQueryResponse {
    count: number;
    orders: OrderResponse[];
}

export async function postOrder(order: OrderRequest, option: ApiOption, retries = 1): Promise<OrderResponse> {
    let r;
    try {
        r = await axios({
            method: 'post',
            url:  toUrl('/openapi/v1/orders/post', option),
            headers: {'x-api-key': option.apiKey},
            data: order,
            timeout: TIME_OUT
        });
    } catch (e) {
        if (retries > 0) {
            console.log("postOrder failed, " + e + ", now try again.");
            await sleep(1000);
            return postOrder(order, option, retries - 1);
        }
        throw Error(`postOrder failed, ${e}, \n order: ${order}`);
    }

    if (r.status == 200) {
        if (r.data.data) {
            return r.data.data as OrderResponse;
        }
        throw Error(`postOrder failed, ${r.data.msg}, order: ${order}`);
    }
    // Too Many Requests
    if (r.status == 429) {
        if (retries > 0) {
            await sleep(1000);
            return postOrder(order, option, retries - 1);
        }
    }
    throw Error(`postOrder failed, status: ${r.status}, order: ${order}`);
}

export async function queryNonce(query: NonceQuery, option: ApiOption, retries = 1): Promise<string> {
    let r;
    try {
        const url = toUrl(`/openapi/v1/orders/nonce?chain=${option.chain}`, option)
          + toKeyVal('maker', query)
          + toKeyVal('exchange', query)
          + toKeyVal('schema', query);

        r = await axios({
            method: 'get',
            url:  url,
            headers: {'x-api-key': option.apiKey},
            timeout: TIME_OUT
        });
    } catch (e) {
        if (retries > 0) {
            console.log("queryNonce failed, " + e + ", now try again.");
            await sleep(1000);
            return queryNonce(query, option, retries - 1);
        }
        throw Error('queryNonce failed, ' + e);
    }

    if (r.status == 200) {
        if (r.data.data) {
            console.log("queryNonce, nonce: " + r.data.data.nonce.toString());
            return r.data.data.nonce.toString();
        }
        throw Error('queryNonce failed, ' + r.data.msg);
    }

    // Too Many Requests
    if (r.status == 429) {
        if (retries > 0) {
            await sleep(1000);
            return queryNonce(query, option, retries - 1);
        }
    }
    throw Error('queryNonce failed, status:' + r.status);
}

export async function queryCollection(assetAddress: string, option: ApiOption, retries = 1): Promise<Collection> {
    let r;
    try {
        const url = toUrl(`/openapi/v1/contract?chain=${option.chain}&contract_address=${assetAddress}`, option);
        r = await axios({
            method: 'get',
            url:  url,
            headers: {'x-api-key': option.apiKey},
            timeout: TIME_OUT
        });
    } catch (e) {
        if (retries > 0) {
            console.log("queryFees failed, " + e + ", now try again.");
            await sleep(1000);
            return queryCollection(assetAddress, option, retries - 1);
        }
        throw Error('queryFees failed, ' + e);
    }

    if (r.status == 200) {
        if (!r.data.data) {
            throw Error('queryFees failed, ' + r.data.msg);
        }

        const collection = r.data.data.collection;
        if (collection.royalty == null || !collection.royaltyAddress) {
            collection.royalty = 0;
            collection.royaltyAddress = '';
        } else {
            collection.royalty = toNumber(collection.royalty);
        }
        if (collection.platformSellerFee == null) {
            collection.platformSellerFee = 0;
        } else {
            collection.platformSellerFee = toNumber(collection.platformSellerFee);
        }

        const paymentTokens:PaymentTokens[] = [];
        if (collection.paymentTokens) {
            for (const token of collection.paymentTokens) {
                paymentTokens.push({
                    name: token.name,
                    address: token.address,
                });
            }
        }
        const fees = {
            platformFeePoint: collection.platformSellerFee,
            royaltyFeePoint: collection.royalty,
            royaltyFeeAddress: collection.royaltyAddress,
            paymentTokens: paymentTokens
        };
        console.log("queryFees, fees: " + JSON.stringify(fees));
        return fees;
    }
    // Too Many Requests
    if (r.status == 429) {
        if (retries > 0) {
            await sleep(1000);
            return queryCollection(assetAddress, option, retries - 1);
        }
    }
    throw Error('queryFees failed, status:' + r.status);
}

export async function queryOrders(query: OrderQuery, option: ApiOption): Promise<OrderQueryResponse> {
    const url = toUrl(`/openapi/v1/orders?chain=${option.chain}`, option)
      + toKeyVal('asset_contract_address', query)
      + toTokenIdsKeyVal(query)
      + toKeyVal('sale_kind', query)
      + toKeyVal('side', query)
      + toKeyVal('maker', query)
      + toKeyVal('taker', query)
      + toKeyVal('payment_token', query)
      + toKeyVal('order_by', query)
      + toKeyVal('direction', query)
      + toKeyVal('listed_before', query)
      + toKeyVal('listed_after', query)
      + toKeyVal('limit', query)
      + toKeyVal('offset', query);

    let r;
    try {
        r = await axios({
            method: 'get',
            url:  url,
            headers: {'x-api-key': option.apiKey},
        });
    } catch (e) {
        throw Error('queryOrders failed, ' + e);
    }

    if (r.status == 200) {
        if (r.data.data) {
            return r.data.data;
        }
        throw Error('queryOrders failed, ' + r.data.msg);
    }
    throw Error('queryOrders failed, code:' + r.status);
}

function toUrl(path: string, option: ApiOption): string {
    return option.isMainnet ? (API_HOST + path) : (API_HOST_TESTNET + path);
}

function toNumber(val: any): number {
    if (typeof(val) == 'number') {
        return val;
    }
    if (val != undefined) {
        return parseInt(val.toString());
    }
    throw Error('queryCollection, toNumber failed');
}

function sleep(ms: number) {
    return Promise.resolve(resolve => setTimeout(resolve, ms));
}

function toTokenIdsKeyVal(query: OrderQuery): string {
    let val = formatVal(query.token_id);
    if (query.token_ids && query.token_ids.length > 0) {
        for (const id of query.token_ids) {
            const idStr = formatVal(id);
            if (idStr != '') {
                if (val != '') {
                    val += ',';
                }
                val += idStr;
            }
        }
    }
    return val != '' ? `&token_ids=${val}` : '';
}

function toKeyVal(key: string, query: OrderQuery): string {
    const val = formatVal(query[key]);
    return val != '' ? `&${key}=${val}` : '';
}

function formatVal(value: any): string {
    if (value != undefined) {
        if (typeof (value) == 'number') {
            BigNumber.config({ EXPONENTIAL_AT: 1024 });
            return new BigNumber(value).toString(10)
        }
        return value.toString().toLowerCase();
    }
    return '';
}
