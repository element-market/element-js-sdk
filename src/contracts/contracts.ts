import { ContractABI, CONTRACTS_ADDRESSES, RPC_URLS } from './config'
import { Contract, ethers, Signer } from 'ethers'

export { ContractABI } from './abi/index'

export const Providers = {
    1: new ethers.providers.JsonRpcProvider(RPC_URLS['1']),
    5: new ethers.providers.JsonRpcProvider(RPC_URLS['5']),
    56: new ethers.providers.JsonRpcProvider(RPC_URLS['6']),
    97: new ethers.providers.JsonRpcProvider(RPC_URLS['97']),
    137: new ethers.providers.JsonRpcProvider(RPC_URLS['137']),
    80001: new ethers.providers.JsonRpcProvider(RPC_URLS['80001']),
    43114: new ethers.providers.JsonRpcProvider(RPC_URLS['43114']),
    43113: new ethers.providers.JsonRpcProvider(RPC_URLS['43113'])
}

export function getElementExContract(chainId: number, signer?: Signer): Contract {
    const address = CONTRACTS_ADDRESSES[chainId].ElementEx
    if (signer) {
        return new Contract(address, ContractABI.elementEx.abi, signer)
    } else {
        return new Contract(address, ContractABI.elementEx.abi, Providers[chainId])
    }
}

export function getElementExSwapContract(chainId: number, signer?: Signer): Contract {
    const address = CONTRACTS_ADDRESSES[chainId].ElementExSwapV2
    if (signer) {
        return new Contract(address, ContractABI.elementExSwap.abi, signer)
    } else {
        return new Contract(address, ContractABI.elementExSwap.abi, Providers[chainId])
    }
}

export function getHelperContract(chainId: number, signer?: Signer): Contract {
    const address = CONTRACTS_ADDRESSES[chainId].Helper
    if (signer) {
        return new Contract(address, ContractABI.helper.abi, signer)
    } else {
        return new Contract(address, ContractABI.helper.abi, Providers[chainId])
    }
}

export function getSeaportContract(chainId: number, signer?: Signer): Contract {
    const address = CONTRACTS_ADDRESSES[chainId].Seaport
    if (address) {
        if (signer) {
            return new Contract(address, ContractABI.seaport.abi, signer)
        } else {
            return new Contract(address, ContractABI.seaport.abi, Providers[chainId])
        }
    } else {
        throw Error('getSeaportContract failed, chainId=' + chainId)
    }
}

export function getLooksRareContract(chainId: number, signer?: Signer): Contract {
    const address = CONTRACTS_ADDRESSES[chainId].LooksRare
    if (address) {
        if (signer) {
            return new Contract(address, ContractABI.looksRare.abi, signer)
        } else {
            return new Contract(address, ContractABI.looksRare.abi, Providers[chainId])
        }
    } else {
        throw Error('getLooksRareContract failed, chainId=' + chainId)
    }
}
