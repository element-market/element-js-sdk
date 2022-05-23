import BigNumber from 'bignumber.js';
import { utils } from 'ethers';
import { ERC1155Order, ERC721Order, Fee, Property } from './EIP712Orders';
import { ETH_TOKEN_ADDRESS, NULL_ADDRESS } from '@txdev/0x-utils';
import { AssetSchema, OrderSide, OrderRequest, OrderResponse, Signature } from '../types/elementTypes';
import { decodeExpiry, encodeExpiry } from './expiryUtil';
import { ElementEx_V3_CONTRACTS_ADDRESSES } from '../contracts/config';
import { getChain, getChainId } from '../util/chainUtil';

export interface NFTOrderInfo {
    chainId: number;
    order: ERC721Order | ERC1155Order;
    sig: Signature;
    orderHash?: string;
}

export function toRequestOrder(orderInfo: NFTOrderInfo): OrderRequest {
    const { order, sig, chainId } = orderInfo;
    const chain = getChain(chainId);
    const contracts = ElementEx_V3_CONTRACTS_ADDRESSES[chainId];

    const info = parseOrder(order);
    const expiry = decodeExpiry(order.expiry);
    const totalERC20Amount = calcTotalERC20Amount(order);
    const paymentToken = order.erc20Token.toLowerCase() == ETH_TOKEN_ADDRESS
      ? NULL_ADDRESS
      : order.erc20Token.toLowerCase();

    const obj: OrderRequest = {
        exchange: contracts.ElementEx.toLowerCase(),
        maker: order.maker.toLowerCase(),
        taker: order.taker.toLowerCase(),
        side: info.side,
        saleKind: expiry.saleKind,
        paymentToken: paymentToken,
        quantity: info.quantity,
        basePrice: totalERC20Amount,
        extra: expiry.extra,
        listingTime: expiry.listingTime,
        expirationTime: expiry.expirationTime,
        metadata: info.metadata,
        fees: toLowerCaseFees(order.fees),
        nonce: order.nonce,
        hashNonce: order.hashNonce,
        signatureType: sig.signatureType,
        v: sig.v,
        r: sig.r,
        s: sig.s,
        chain: chain
    }
    if (orderInfo.orderHash != undefined) {
        obj.hash = orderInfo.orderHash;
    }
    if (info.properties != undefined) {
        obj.properties = toLowerCaseProperties(info.properties);
    }
    return obj;
}

export function toNFTOrder(responseOrder: OrderResponse, isMainnet: boolean): NFTOrderInfo {
    const obj = responseOrder;
    const expiry = encodeExpiry(obj.saleKind, obj.extra, obj.listingTime, obj.expirationTime);
    const fees = toStandardFees(obj.fees);
    const erc20Token = obj.paymentToken.toLowerCase() == NULL_ADDRESS
      ? ETH_TOKEN_ADDRESS
      : utils.getAddress(obj.paymentToken);
    const erc20TokenAmount = calcPayERC20Amount(obj.basePrice, fees);

    const order: any = {
        maker: utils.getAddress(obj.maker),
        taker: utils.getAddress(obj.taker),
        expiry: expiry,
        nonce: toNumStr(obj.nonce, 10),
        erc20Token: erc20Token,
        erc20TokenAmount: erc20TokenAmount,
        fees: fees,
        hashNonce: toNumStr(obj.hashNonce, 10)
    }

    if (obj.schema == AssetSchema.ERC721) {
        order.nft = utils.getAddress(obj.assetContract);
        order.nftId = toNumStr(obj.assetTokenId, 10);
        if (new BigNumber(obj.side).eq(OrderSide.BuyOrder)) {
            order.nftProperties = toStandardProperties(obj.properties);
        }
    } else if (obj.schema == AssetSchema.ERC1155) {
        order.erc1155Token = utils.getAddress(obj.assetContract);
        order.erc1155TokenId = toNumStr(obj.assetTokenId, 10);
        order.erc1155TokenAmount = toNumStr(obj.quantity, 10);
        if (new BigNumber(obj.side).eq(OrderSide.BuyOrder)) {
            order.erc1155TokenProperties = toStandardProperties(obj.properties);
        }
    } else {
        throw Error("toOrder, unsupported asset : " + obj.schema);
    }

    return {
        chainId: getChainId(obj.chain, isMainnet),
        order: order,
        sig: {
            signatureType: obj.signatureType,
            v: obj.v,
            r: obj.r,
            s: obj.s,
        }
    };
}

export function toStandardNFTOrder(order: ERC721Order | ERC1155Order): ERC721Order | ERC1155Order {
    if (order['nft'] != undefined) {
        return toStandardERC721Order(order as ERC721Order);
    } else {
        return toStandardERC1155Order(order as ERC1155Order);
    }
}

export function toStandardERC721Order(order: ERC721Order): ERC721Order {
    const standardOrder: ERC721Order = {
        maker: utils.getAddress(order.maker),
        taker: utils.getAddress(order.taker),
        expiry: order.expiry,
        nonce: toNumStr(order.nonce, 10),
        erc20Token: utils.getAddress(order.erc20Token),
        erc20TokenAmount: toNumStr(order.erc20TokenAmount, 10),
        fees: toStandardFees(order.fees),
        nft: utils.getAddress(order.nft),
        nftId: toNumStr(order.nftId, 10),
        hashNonce: toNumStr(order.hashNonce, 10)
    };
    if (order.nftProperties != undefined) {
        standardOrder.nftProperties = toStandardProperties(order.nftProperties);
    }
    return standardOrder;
}

export function toStandardERC1155Order(order: ERC1155Order): ERC1155Order {
    const standardOrder: ERC1155Order = {
        maker: utils.getAddress(order.maker),
        taker: utils.getAddress(order.taker),
        expiry: order.expiry,
        nonce: toNumStr(order.nonce, 10),
        erc20Token: utils.getAddress(order.erc20Token),
        erc20TokenAmount: toNumStr(order.erc20TokenAmount, 10),
        fees: toStandardFees(order.fees),
        erc1155Token: utils.getAddress(order.erc1155Token),
        erc1155TokenId: toNumStr(order.erc1155TokenId, 10),
        erc1155TokenAmount: toNumStr(order.erc1155TokenAmount, 10),
        hashNonce: toNumStr(order.hashNonce, 10),
    };
    if (order.erc1155TokenProperties != undefined) {
        standardOrder.erc1155TokenProperties = toStandardProperties(order.erc1155TokenProperties);
    }
    return standardOrder;
}

function toNumStr(num: BigNumber.Value, base: number): string {
    BigNumber.config({ EXPONENTIAL_AT: 1024});
    return new BigNumber(num).toString(base);
}

function toStandardFees(fees: Fee[]): Fee[] {
    if (fees != undefined) {
        return fees.map(fee => ({
            recipient: utils.getAddress(fee.recipient),
            amount: toNumStr(fee.amount, 10),
            feeData: fee.feeData,
        }));
    }
    return [];
}

function toStandardProperties(properties: Property[] | undefined): Property[] {
    if (properties) {
        return properties.map(property => ({
            propertyValidator: utils.getAddress(property.propertyValidator),
            propertyData: property.propertyData,
        }));
    }
    return [];
}

function toLowerCaseFees(fees: Fee[]): Fee[] {
    return fees.map(fee => ({
        recipient: fee.recipient.toLowerCase(),
        amount: toNumStr(fee.amount, 10),
        feeData: fee.feeData,
    }));
}

function toLowerCaseProperties(properties: Property[]): Property[] {
    return properties.map(property => ({
        propertyValidator: property.propertyValidator.toLowerCase(),
        propertyData: property.propertyData,
    }));
}

function calcTotalERC20Amount(order: ERC721Order | ERC1155Order): string {
    let total = new BigNumber(order.erc20TokenAmount);
    for (let i = 0; i < order.fees.length; i++) {
        total = total.plus(order.fees[i].amount);
    }
    BigNumber.config({ EXPONENTIAL_AT: 1024});
    return total.toString(10);
}

function calcPayERC20Amount(totalTokenAmount: any, fees: Fee[]): string {
    let payAmount = new BigNumber(totalTokenAmount);
    for (let i = 0; i < fees.length; i++) {
        payAmount = payAmount.minus(fees[i].amount);
    }
    BigNumber.config({ EXPONENTIAL_AT: 1024});
    return payAmount.toString(10);
}

function parseOrder(order: ERC721Order | ERC1155Order) {
    let side: OrderSide;
    let quantity: string;
    let metadata;
    let properties;
    if (order['nft'] != undefined) {
        quantity = "1";
        metadata = {
            asset: {
                id: order['nftId'],
                address: order['nft']
            },
            schema: AssetSchema.ERC721
        };

        if (order['nftProperties'] != undefined) {
            side = OrderSide.BuyOrder;
            properties = toLowerCaseProperties(order['nftProperties']);
        } else {
            side = OrderSide.SellOrder;
            properties = undefined;
        }
    } else if (order['erc1155Token'] != undefined) {
        quantity = order['erc1155TokenAmount'];
        metadata = {
            asset: {
                id: order['erc1155TokenId'],
                address: order['erc1155Token']
            },
            schema: AssetSchema.ERC1155
        };

        if (order['erc1155TokenProperties'] != undefined) {
            side = OrderSide.BuyOrder;
            properties = toLowerCaseProperties(order['erc1155TokenProperties']);
        } else {
            side = OrderSide.SellOrder;
            properties = undefined;
        }
    } else {
        throw Error("toOrderStr error");
    }
    return { side, quantity, metadata, properties };
}

