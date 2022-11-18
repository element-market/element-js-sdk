import { ContractABI, CONTRACTS_ADDRESSES } from './config'
import { Contract, Signer } from 'ethers'

export { ContractABI } from './abi/index'

export function getElementExContract(chainId: number, signer: Signer): Contract {
    const address = CONTRACTS_ADDRESSES[chainId].ElementEx
    return new Contract(address, ContractABI.elementEx.abi, signer)
}

export function getElementExSwapContract(chainId: number, signer: Signer): Contract {
    const address = CONTRACTS_ADDRESSES[chainId].ElementExSwapV2
    return new Contract(address, ContractABI.elementExSwap.abi, signer)
}

export function getHelperContract(chainId: number, signer: Signer): Contract {
    const address = CONTRACTS_ADDRESSES[chainId].Helper
    return new Contract(address, ContractABI.helper.abi, signer)
}

export function getSeaportContract(chainId: number, signer: Signer): Contract {
    const address = CONTRACTS_ADDRESSES[chainId].Seaport
    if (address) {
        return new Contract(address, ContractABI.seaport.abi, signer)
    } else {
        throw Error('getSeaportContract failed, chainId=' + chainId)
    }
}

export function getLooksRareContract(chainId: number, signer: Signer): Contract {
    const address = CONTRACTS_ADDRESSES[chainId].LooksRare
    if (address) {
        return new Contract(address, ContractABI.looksRare.abi, signer)
    } else {
        throw Error('getLooksRareContract failed, chainId=' + chainId)
    }
}
