import { BigNumber } from 'ethers'

export function toString(val: any): string {
    if (val != null) {
        if (typeof(val) == 'number') {
            return BigNumber.from('0x' + val.toString(16)).toString()
        }
        return BigNumber.from(val).toString()
    }
    return ''
}

export function toNumber(val: any): number | undefined {
    return val != null ? Number(val.toString()) : undefined
}

export function toHexValue(value: string) {
    const hex = BigNumber.from(value).toHexString()
    if (hex.startsWith('0x0') && hex.length > 3) {
        return '0x' + hex.substring(3)
    }
    return hex
}
