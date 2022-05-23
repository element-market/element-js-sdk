import { ElementEx_V3_CONTRACTS_ADDRESSES } from '../contracts/config';
import {
    createExchangeProxyEIP712Domain,
    EIP712TypedData,
    getExchangeProxyEIP712Hash,
    getTypeHash,
    hexUtils,
} from '@txdev/0x-utils';

export interface Fee {
    recipient: string;
    amount: string;
    feeData: string;
}

export interface Property {
    propertyValidator: string;
    propertyData: string;
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

// FEE_TYPE_HASH、PROPERTY_TYPE_HASH
const FEE_ABI = [
    {type: 'address', name: 'recipient'},
    {type: 'uint256', name: 'amount'},
    {type: 'bytes', name: 'feeData'},
];
const PROPERTY_ABI = [
    {type: 'address', name: 'propertyValidator'},
    {type: 'bytes', name: 'propertyData'},
];
const FEE_TYPE_HASH = getTypeHash('Fee', FEE_ABI);
const PROPERTY_TYPE_HASH = getTypeHash('Property', PROPERTY_ABI);

// ERC721Order EIP712 information
const STRUCT_ERC721_SELL_ORDER_NAME = 'NFTSellOrder';
const STRUCT_ERC721_BUY_ORDER_NAME = 'NFTBuyOrder';
const STRUCT_ERC721_SELL_ORDER_ABI = [
    {type: 'address', name: 'maker'},
    {type: 'address', name: 'taker'},
    {type: 'uint256', name: 'expiry'},
    {type: 'uint256', name: 'nonce'},
    {type: 'address', name: 'erc20Token'},
    {type: 'uint256', name: 'erc20TokenAmount'},
    {type: 'Fee[]', name: 'fees'},
    {type: 'address', name: 'nft'},
    {type: 'uint256', name: 'nftId'},
    {type: 'uint256', name: 'hashNonce'}
];
const STRUCT_ERC721_BUY_ORDER_ABI = [
    {type: 'address', name: 'maker'},
    {type: 'address', name: 'taker'},
    {type: 'uint256', name: 'expiry'},
    {type: 'uint256', name: 'nonce'},
    {type: 'address', name: 'erc20Token'},
    {type: 'uint256', name: 'erc20TokenAmount'},
    {type: 'Fee[]', name: 'fees'},
    {type: 'address', name: 'nft'},
    {type: 'uint256', name: 'nftId'},
    {type: 'Property[]', name: 'nftProperties'},
    {type: 'uint256', name: 'hashNonce'}
];
const TYPE_ERC721_SELL_ORDER_HASH = getTypeHash(STRUCT_ERC721_SELL_ORDER_NAME, STRUCT_ERC721_SELL_ORDER_ABI, {
    ['Fee']: FEE_ABI
});
const TYPE_ERC721_BUY_ORDER_HASH = getTypeHash(STRUCT_ERC721_BUY_ORDER_NAME, STRUCT_ERC721_BUY_ORDER_ABI, {
    ['Fee']: FEE_ABI,
    ['Property']: PROPERTY_ABI,
});

// ERC1155Order EIP712 information
const STRUCT_ERC1155_SELL_ORDER_NAME = 'ERC1155SellOrder';
const STRUCT_ERC1155_BUY_ORDER_NAME = 'ERC1155BuyOrder';
const STRUCT_ERC1155_SELL_ORDER_ABI = [
    {type: 'address', name: 'maker'},
    {type: 'address', name: 'taker'},
    {type: 'uint256', name: 'expiry'},
    {type: 'uint256', name: 'nonce'},
    {type: 'address', name: 'erc20Token'},
    {type: 'uint256', name: 'erc20TokenAmount'},
    {type: 'Fee[]', name: 'fees'},
    {type: 'address', name: 'erc1155Token'},
    {type: 'uint256', name: 'erc1155TokenId'},
    {type: 'uint128', name: 'erc1155TokenAmount'},
    {type: 'uint256', name: 'hashNonce'},
];
const STRUCT_ERC1155_BUY_ORDER_ABI = [
    {type: 'address', name: 'maker'},
    {type: 'address', name: 'taker'},
    {type: 'uint256', name: 'expiry'},
    {type: 'uint256', name: 'nonce'},
    {type: 'address', name: 'erc20Token'},
    {type: 'uint256', name: 'erc20TokenAmount'},
    {type: 'Fee[]', name: 'fees'},
    {type: 'address', name: 'erc1155Token'},
    {type: 'uint256', name: 'erc1155TokenId'},
    {type: 'Property[]', name: 'erc1155TokenProperties'},
    {type: 'uint128', name: 'erc1155TokenAmount'},
    {type: 'uint256', name: 'hashNonce'},
];
const TYPE_ERC1155_SELL_ORDER_HASH = getTypeHash(STRUCT_ERC1155_SELL_ORDER_NAME, STRUCT_ERC1155_SELL_ORDER_ABI, {
    ['Fee']: FEE_ABI
});
const TYPE_ERC1155_BUY_ORDER_HASH = getTypeHash(STRUCT_ERC1155_BUY_ORDER_NAME, STRUCT_ERC1155_BUY_ORDER_ABI, {
    ['Fee']: FEE_ABI,
    ['Property']: PROPERTY_ABI,
});

export function getOrderHash(order: ERC721Order | ERC1155Order, chainId: number): string {
    if (order['nft'] != undefined) {
        return getERC721OrderHash(order as ERC721Order, chainId);
    } else {
        return getERC1155OrderHash(order as ERC1155Order, chainId);
    }
}

export function getOrderTypedData(order: ERC721Order | ERC1155Order, chainId: number): EIP712TypedData {
    if (order['nft'] != undefined) {
        return getERC721TypedData(order as ERC721Order, chainId);
    } else {
        return getERC1155TypedData(order as ERC1155Order, chainId);
    }
}

export function getERC721OrderHash(order: ERC721Order, chainId: number): string {
    let structHash: string;
    if (order.nftProperties == undefined) {
        // ERC721SellOrder
        structHash = hexUtils.hash(
          hexUtils.concat(
            hexUtils.leftPad(TYPE_ERC721_SELL_ORDER_HASH),
            hexUtils.leftPad(order.maker),
            hexUtils.leftPad(order.taker),
            hexUtils.leftPad(order.expiry),
            hexUtils.leftPad(order.nonce),
            hexUtils.leftPad(order.erc20Token),
            hexUtils.leftPad(order.erc20TokenAmount),
            getFeesHash(order.fees),
            hexUtils.leftPad(order.nft),
            hexUtils.leftPad(order.nftId),
            hexUtils.leftPad(order.hashNonce),
          ),
        );
    } else {
        // ERC721BuyOrder
        structHash = hexUtils.hash(
          hexUtils.concat(
            hexUtils.leftPad(TYPE_ERC721_BUY_ORDER_HASH),
            hexUtils.leftPad(order.maker),
            hexUtils.leftPad(order.taker),
            hexUtils.leftPad(order.expiry),
            hexUtils.leftPad(order.nonce),
            hexUtils.leftPad(order.erc20Token),
            hexUtils.leftPad(order.erc20TokenAmount),
            getFeesHash(order.fees),
            hexUtils.leftPad(order.nft),
            hexUtils.leftPad(order.nftId),
            getPropertiesHash(order.nftProperties),
            hexUtils.leftPad(order.hashNonce),
          ),
        );
    }
    return getExchangeProxyEIP712Hash(structHash, chainId, getVerifyingContract(chainId));
}

export function getERC1155OrderHash(order: ERC1155Order, chainId: number): string {
    let structHash: string;
    if (order.erc1155TokenProperties == undefined) {
        // ERC1155SellOrder
        structHash = hexUtils.hash(
          hexUtils.concat(
            hexUtils.leftPad(TYPE_ERC1155_SELL_ORDER_HASH),
            hexUtils.leftPad(order.maker),
            hexUtils.leftPad(order.taker),
            hexUtils.leftPad(order.expiry),
            hexUtils.leftPad(order.nonce),
            hexUtils.leftPad(order.erc20Token),
            hexUtils.leftPad(order.erc20TokenAmount),
            getFeesHash(order.fees),
            hexUtils.leftPad(order.erc1155Token),
            hexUtils.leftPad(order.erc1155TokenId),
            hexUtils.leftPad(order.erc1155TokenAmount),
            hexUtils.leftPad(order.hashNonce),
          ),
        );
    } else {
        // ERC1155BuyOrder
        structHash = hexUtils.hash(
          hexUtils.concat(
            hexUtils.leftPad(TYPE_ERC1155_BUY_ORDER_HASH),
            hexUtils.leftPad(order.maker),
            hexUtils.leftPad(order.taker),
            hexUtils.leftPad(order.expiry),
            hexUtils.leftPad(order.nonce),
            hexUtils.leftPad(order.erc20Token),
            hexUtils.leftPad(order.erc20TokenAmount),
            getFeesHash(order.fees),
            hexUtils.leftPad(order.erc1155Token),
            hexUtils.leftPad(order.erc1155TokenId),
            getPropertiesHash(order.erc1155TokenProperties!),
            hexUtils.leftPad(order.erc1155TokenAmount),
            hexUtils.leftPad(order.hashNonce),
          ),
        );
    }
    return getExchangeProxyEIP712Hash(structHash, chainId, getVerifyingContract(chainId));
}

export function getERC721TypedData(order: ERC721Order, chainId: number): EIP712TypedData {
    const domain = createExchangeProxyEIP712Domain(chainId, getVerifyingContract(chainId));
    if (order.nftProperties == undefined) {
        // ERC721SellOrder
        return {
            types: {
                [STRUCT_ERC721_SELL_ORDER_NAME]: STRUCT_ERC721_SELL_ORDER_ABI,
                ['Fee']: FEE_ABI
            },
            domain: domain as any,
            primaryType: STRUCT_ERC721_SELL_ORDER_NAME,
            message: order as any,
        }
    } else {
        // ERC721BuyOrder
        return {
            types: {
                [STRUCT_ERC721_BUY_ORDER_NAME]: STRUCT_ERC721_BUY_ORDER_ABI,
                ['Fee']: FEE_ABI,
                ['Property']: PROPERTY_ABI,
            },
            domain: domain as any,
            primaryType: STRUCT_ERC721_BUY_ORDER_NAME,
            message: order as any,
        };
    }
}

export function getERC1155TypedData(order: ERC1155Order, chainId: number): EIP712TypedData {
    const domain = createExchangeProxyEIP712Domain(chainId, getVerifyingContract(chainId));
    if (order.erc1155TokenProperties == undefined) {
        // ERC1155SellOrder
        return {
            types: {
                [STRUCT_ERC1155_SELL_ORDER_NAME]: STRUCT_ERC1155_SELL_ORDER_ABI,
                ['Fee']: FEE_ABI
            },
            domain: domain as any,
            primaryType: STRUCT_ERC1155_SELL_ORDER_NAME,
            message: order as any,
        }
    } else {
        // ERC1155BuyOrder
        return {
            types: {
                [STRUCT_ERC1155_BUY_ORDER_NAME]: STRUCT_ERC1155_BUY_ORDER_ABI,
                ['Fee']: FEE_ABI,
                ['Property']: PROPERTY_ABI,
            },
            domain: domain as any,
            primaryType: STRUCT_ERC1155_BUY_ORDER_NAME,
            message: order as any,
        };
    }
}

function getFeesHash(fees: Fee[]): string {
    return hexUtils.hash(
      hexUtils.concat(
        ...fees.map((fee: Fee) =>
          hexUtils.hash(
            hexUtils.concat(
              hexUtils.leftPad(FEE_TYPE_HASH),
              hexUtils.leftPad(fee.recipient),
              hexUtils.leftPad(fee.amount),
              hexUtils.hash(fee.feeData),
            ),
          ),
        ),
      ),
    );
}

function getPropertiesHash(properties: Property[]): string {
    return hexUtils.hash(
      hexUtils.concat(
        ...properties.map(property =>
          hexUtils.hash(
            hexUtils.concat(
              hexUtils.leftPad(PROPERTY_TYPE_HASH),
              hexUtils.leftPad(property.propertyValidator),
              hexUtils.hash(property.propertyData),
            ),
          ),
        ),
      ),
    );
}

function getVerifyingContract(chainId: number): string {
    const verifyingContract = ElementEx_V3_CONTRACTS_ADDRESSES[chainId].ElementEx;
    if (verifyingContract) {
        return verifyingContract;
    }
    throw Error("getVerifyingContract, unsupported chainId : " + chainId);
}
