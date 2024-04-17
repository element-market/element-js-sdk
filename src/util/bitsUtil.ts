import { BigNumber } from 'ethers'

export function encodeBits(args: any[][]): string {
  let data = '0x'
  for (const arg of args) {
    data += toHexBytes(BigNumber.from(arg[0].toString()).toHexString(), arg[1])
  }
  return data
}

function toHexBytes(hexStr: string, bitCount: number) {
  const count = bitCount / 4
  const str = hexStr.toLowerCase().startsWith('0x') ? hexStr.substring(2).toLowerCase() : hexStr.toLowerCase()
  if (str.length > count) {
    return str.substring(str.length - count)
  }
  let zero = ''
  for (let i = str.length; i < count; i++) {
    zero += '0'
  }
  return zero + str
}
