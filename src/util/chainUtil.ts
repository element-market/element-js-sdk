import { Network } from '../types/types'

const CHAIN_NAMES: { [key: number]: string } = {
    1: Network.ETH,
    5: Network.ETH,
    56: Network.BSC,
    97: Network.BSC,
    137: Network.Polygon,
    43114: Network.Avalanche,
    42161: Network.Arbitrum,
    324: Network.ZkSync,
    59144: Network.Linea,
    8453: Network.Base,
    204: Network.OpBNB,
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
                return 5
        
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
        }
        throw Error('getChainId, unsupported chain : ' + chain)
    }
}
