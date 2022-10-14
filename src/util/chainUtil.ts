export enum Network {
    ETH = 'eth',
    BSC = 'bsc',
    Polygon = 'polygon',
    Avalanche = 'avalanche',
}

const CHAIN_NAMES: { [key: number]: string } = {
    1: Network.ETH,
    5: Network.ETH,
    56: Network.BSC,
    97: Network.BSC,
    137: Network.Polygon,
    80001: Network.Polygon,
    43114: Network.Avalanche,
    43113: Network.Avalanche,
};

export function getChain(chainId: number): string {
    if (CHAIN_NAMES[chainId]) {
        return CHAIN_NAMES[chainId];
    }
    throw Error("getChain, unsupported chainId : " + chainId);
}

export function getChainId(chain: any, isMainnet: boolean): number {
    if (chain) {
        switch (chain.toString()) {
            case Network.ETH:
                return isMainnet ? 1 : 5;

            case Network.BSC:
                return isMainnet ? 56 : 97;

            case Network.Polygon:
                return isMainnet ? 137 : 80001;

            case Network.Avalanche:
                return isMainnet ? 43114 : 43113;
        }
    }
    throw Error("getChainId, unsupported chain : " + chain);
}


