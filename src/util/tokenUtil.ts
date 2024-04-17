import { ETH_TOKEN_ADDRESS, NULL_ADDRESS } from '../types/types'

export function toContractERC20Token(erc20Token?: string) {
  if (erc20Token && erc20Token.toLowerCase() != NULL_ADDRESS) {
    return erc20Token.toLowerCase()
  }
  return ETH_TOKEN_ADDRESS
}

export function toStandardERC20Token(erc20Token?: string) {
  if (erc20Token && erc20Token.toLowerCase() != ETH_TOKEN_ADDRESS) {
    return erc20Token.toLowerCase()
  }
  return NULL_ADDRESS
}
