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
