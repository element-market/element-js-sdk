import { Network } from '../types/types'

const CHAIN_NAMES: { [key: number]: string } = {
  1: Network.ETH,
  11155111: Network.ETH,
  56: Network.BSC,
  97: Network.BSC,
  137: Network.Polygon,
  43114: Network.Avalanche,
  42161: Network.Arbitrum,
  324: Network.ZkSync,
  59144: Network.Linea,
  8453: Network.Base,
  204: Network.OpBNB,
  534352: Network.Scroll,
  169: Network.MantaPacific,
  10: Network.Optimism,
  5000: Network.Mantle,
  42766: Network.ZKFair,
  81457: Network.Blast,
  4200: Network.Merlin
}

export function getChain(chainId: number): string {
  if (CHAIN_NAMES[chainId]) {
    return CHAIN_NAMES[chainId]
  }
  throw Error('getChain, unsupported chainId : ' + chainId)
}

export function getChainId(chain: any, isTestnet = false): number {
  if (isTestnet) {
    switch (chain.toString()) {
      case Network.ETH:
        return 11155111
      
      case Network.BSC:
        return 97
    }
    throw Error('getChainId, unsupported chain : ' + chain)
  } else {
    switch (chain.toString()) {
      case Network.ETH:
        return 1
      
      case Network.BSC:
        return 56
      
      case Network.Polygon:
        return 137
      
      case Network.Avalanche:
        return 43114
      
      case Network.Arbitrum:
        return 42161
      
      case Network.ZkSync:
        return 324
      
      case Network.Linea:
        return 59144
      
      case Network.Base:
        return 8453
      
      case Network.OpBNB:
        return 204
      
      case Network.Scroll:
        return 534352
      
      case Network.MantaPacific:
        return 169
      
      case Network.Optimism:
        return 10
      
      case Network.Mantle:
        return 5000
      
      case Network.ZKFair:
        return 42766
      
      case Network.Blast:
        return 81457
      
      case Network.Merlin:
        return 4200
    }
    throw Error('getChainId, unsupported chain : ' + chain)
  }
}
