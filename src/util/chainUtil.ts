import { Network } from '../types/types'

const CHAIN_NAMES: { [key: number]: string } = {
    1: Network.ETH,
    5: Network.ETH,
    56: Network.BSC,
    97: Network.BSC,
    137: Network.Polygon,
    80001: Network.Polygon,
    43114: Network.Avalanche,
    43113: Network.Avalanche
}

export function getChain(chainId: number): string {
    if (CHAIN_NAMES[chainId]) {
        return CHAIN_NAMES[chainId]
    }
    throw Error('getChain, unsupported chainId : ' + chainId)
}

export function getChainId(chain: any, isTestnet = false): number {
    if (chain) {
        switch (chain.toString()) {
            case Network.ETH:
                return !isTestnet ? 1 : 5
            
            case Network.BSC:
                return !isTestnet ? 56 : 97
            
            case Network.Polygon:
                return !isTestnet ? 137 : 80001
            
            case Network.Avalanche:
                return !isTestnet ? 43114 : 43113
        }
    }
    throw Error('getChainId, unsupported chain : ' + chain)
}


