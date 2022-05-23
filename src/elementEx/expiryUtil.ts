import { SaleKind } from "../types/elementTypes";
import BigNumber from "bignumber.js";

export interface ExpiryInfo {
    saleKind: SaleKind;
    extra: string;
    listingTime: string;
    expirationTime: string;
}

export function encodeExpiry(orderSaleKind: BigNumber.Value, extra: BigNumber.Value, listingTime: BigNumber.Value, expiryTime: BigNumber.Value): string {
    // priceType (4bit) + reserved(156bit) + extra(32bit) + listingTime(32bit) + expiryTime(32bit) = 256bit
    return "0x" +
      formatNumber(orderSaleKind, 4) +
      formatNumber(0, 156) +
      formatNumber(extra, 32) +
      formatNumber(listingTime, 32) +
      formatNumber(expiryTime, 32);
}

export function decodeExpiry(expiry: string): ExpiryInfo {
    // priceType (4bit) + reserved(156bit) + extra(32bit) + listingTime(32bit) + expiryTime(32bit) = 256bit
    const hex = formatNumber(expiry, 256);
    const orderSaleKindHex = '0x' + hex.substring(0, 1);
    const extraHex = '0x' + hex.substring(40, 48);
    const listingTimeHex = '0x' + hex.substring(48, 56);
    const expiryTimeHex = '0x' + hex.substring(56, 64);
    return {
        saleKind: parseInt(orderSaleKindHex),
        extra: parseInt(extraHex).toString(),
        listingTime: parseInt(listingTimeHex).toString(),
        expirationTime: parseInt(expiryTimeHex).toString()
    }
}

function formatNumber(num: BigNumber.Value, bitCount: number) {
    BigNumber.config({ EXPONENTIAL_AT: 1024 });
    const hexStr = new BigNumber(num).toString(16);
    return formatHexBytes(hexStr, bitCount);
}

function formatHexBytes(hexStr: string, bitCount: number) {
    const count = bitCount / 4;
    const str = hexStr.toLowerCase().startsWith("0x") ? hexStr.substring(2).toLowerCase() : hexStr.toLowerCase();
    if (str.length > count) {
        return str.substring(str.length - count);
    }
    let zero = '';
    for (let i = str.length; i < count; i++) {
        zero += '0';
    }
    return zero + str;
}
