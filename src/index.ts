import { Network } from './util/chainUtil';
import { SignerOrProvider, Singers } from './elementEx/singers';
import { ElementEx } from './elementEx/elementEx';
import {
    ApiOption,
    queryCollection,
    queryNonce,
    queryOrders,
    postOrder,
    Collection,
    OrderQuery,
    OrderQueryResponse
} from './api/openApi';
import { getChainId } from './util/chainUtil';
import { toNFTOrder, toRequestOrder } from './elementEx/orderConverter';
import { AssetSchema, OrderResponse, SaleKind } from './types/elementTypes'
import { NULL_ADDRESS } from '@txdev/0x-utils';
import { ETH_TOKEN_ADDRESS } from '@txdev/0x-utils/lib/src/types';
import BigNumber from 'bignumber.js';
import { TransactionReceipt } from '@ethersproject/abstract-provider';

export interface ElementAPIConfig {
    networkName: Network;
    apiKey: string;
    signer: SignerOrProvider;
    gasPrice?: string | number;
    isTestnet?: boolean;
}

export interface MakeOrderParams {
    takerAddress?: string;
    assetId?: string | number;
    assetAddress: string;
    assetSchema?: AssetSchema;
    quantity?: string | number;
    paymentToken?: string;
    startTokenAmount: string | number;
    listingTime?: string | number;
    expirationTime?: string | number;
    saleKind?: SaleKind;
    endTokenAmount?: string | number;
}

export interface FillOrderParams {
    order?: OrderResponse;
    orderJsonStr?: string;
    quantity?: string | number;
    assetId?: string | number;
}

export interface CancelOrderParams {
    order?: OrderResponse;
    orderJsonStr?: string;
}

export class ElementSDK {

    public chainId: number;
    public apiOption: ApiOption;
    public singers: Singers;
    public elementEx: ElementEx;
    public isMainnet: boolean = true;

    constructor(config: ElementAPIConfig) {
        if (config.isTestnet) {
            this.isMainnet = false;
        }
        this.chainId = getChainId(config.networkName, this.isMainnet);
        this.apiOption = {
            chain: config.networkName,
            isMainnet: this.isMainnet,
            apiKey: config.apiKey
        }
        this.singers = new Singers(config.signer, this.chainId, config.gasPrice);
        this.elementEx = new ElementEx(this.singers);
    }

    public async makeSellOrder(params: MakeOrderParams): Promise<OrderResponse> {
        return await this.makeOrder(params, false);
    }

    public async makeBuyOrder(params: MakeOrderParams): Promise<OrderResponse> {
        return await this.makeOrder(params, true);
    }

    public async fillOrder(params: FillOrderParams): Promise<TransactionReceipt> {
        let order;
        if (params.order) {
            order = toNFTOrder(params.order, this.isMainnet);
        } else if (params.orderJsonStr) {
            const orderResponse = JSON.parse(params.orderJsonStr);
            order = toNFTOrder(orderResponse, this.isMainnet);
        } else {
            throw Error("fillOrder failed, order or orderJsonStr should be set.");
        }
        if (order.chainId != this.chainId) {
            throw Error(`fillOrder failed, order.chainId(${order.chainId}) mismatch this.chainId${this.chainId}`);
        }

        const account = await this.singers.getCurrentAccount();
        console.log("fillOrder, currentAccount: " + account);
        return await this.elementEx.fillOrder({
            order: order.order,
            sig: order.sig,
            takerAddress: account,
            quantity: params.quantity,
            assetId: params.assetId
        });
    }

    public async cancelOrder(params: CancelOrderParams): Promise<TransactionReceipt> {
        let order;
        if (params.order) {
            order = toNFTOrder(params.order, this.isMainnet);
        } else if (params.orderJsonStr) {
            const orderResponse = JSON.parse(params.orderJsonStr);
            order = toNFTOrder(orderResponse, this.isMainnet);
        } else {
            throw Error("cancelOrder failed, order or orderJsonStr should be set.");
        }
        if (order.chainId != this.chainId) {
            throw Error(`cancelOrder failed, order.chainId(${order.chainId}) mismatch this.chainId${this.chainId}`);
        }
        return await this.elementEx.cancelOrder(order.order);
    }

    public async cancelAllOrder(): Promise<TransactionReceipt>  {
        const accountAddress = await this.singers.getCurrentAccount();
        console.log("cancelAllOrder, account: " + accountAddress);
        return await this.elementEx.cancelAllOrder(accountAddress);
    }

    public async queryOrders(query: OrderQuery): Promise<OrderQueryResponse>  {
        return await queryOrders(query, this.apiOption);
    }

    private async makeOrder(params: MakeOrderParams, buyOrder: boolean): Promise<OrderResponse> {
        // check params
        if (params.quantity && new BigNumber(params.quantity).gt('0xffffffffffffffff')) {
            throw Error('makeOrder, quantity exceeded maximum limit: (2**64 - 1)');
        }
        const schema = (params.assetSchema != undefined) ? params.assetSchema : AssetSchema.ERC721;
        if (schema != AssetSchema.ERC721 && schema != AssetSchema.ERC1155) {
            throw Error('makeOrder failed, unsupported schema : ' + schema);
        }

        const accountAddress = await this.singers.getCurrentAccount();
        console.log("makeOrder, currentAccount: " + accountAddress);

        // query nonce
        const nonce = await queryNonce({
            maker: accountAddress,
            exchange: this.elementEx.elementExV3.address,
            schema: schema
        }, this.apiOption);
        // query collection
        const collection = await queryCollection(params.assetAddress, this.apiOption);

        // make order
        const paymentToken = this.getPaymentToken(params, collection, buyOrder);
        const orderParams = {
            makerAddress: accountAddress,
            takerAddress: (params.takerAddress != undefined) ? params.takerAddress : NULL_ADDRESS,
            asset: {
                id: params.assetId,
                address: params.assetAddress,
                schema: schema,
            },
            quantity: params.quantity,
            paymentToken: paymentToken,
            startTokenAmount: params.startTokenAmount,
            platformFeePoint: collection.platformFeePoint,
            royaltyFeePoint: collection.royaltyFeePoint,
            royaltyFeeAddress: collection.royaltyFeeAddress,
            listingTime: toNumber(params.listingTime),
            expirationTime: toNumber(params.listingTime),
            nonce: nonce,
            saleKind: params.saleKind,
            endTokenAmount: params.endTokenAmount
        };
        const orderInfo = buyOrder
          ? await this.elementEx.makeBuyOrder(orderParams)
          : await this.elementEx.makeSellOrder(orderParams);

        // post order
        const order = toRequestOrder(orderInfo);
        return await postOrder(order, this.apiOption);
    }

    private getPaymentToken(params: MakeOrderParams, collection: Collection, buyOrder: boolean): string {
        if (params.paymentToken == undefined) {
            return buyOrder ? this.elementEx.WToken : ETH_TOKEN_ADDRESS;
        }

        const address = params.paymentToken.toLowerCase();
        if (address == NULL_ADDRESS || address == ETH_TOKEN_ADDRESS || address == this.elementEx.WToken.toLowerCase()) {
            return params.paymentToken;
        }
        for (const token of collection.paymentTokens) {
            if (address == token.address) {
                return params.paymentToken;
            }
        }
        throw Error('makeOrder: checkPaymentToken failed, expected tokens: ' + collection.paymentTokens);
    }
}

function toNumber(val: any): number | undefined {
    if (typeof(val) == 'number') {
        return val;
    }
    if (typeof(val) == 'string') {
        return parseInt(val.toString());
    }
    return undefined;
}
