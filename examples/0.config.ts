import { ElementSDK } from '../src'
import { ethers } from 'ethers'
import { Network } from '../src/types/types'
import { RPC_URLS } from '../src/contracts/config'
import { getChainId } from '../src/util/chainUtil'
import { TimeoutWeb3Provider } from './TimeoutWeb3Provider'
import { TimeoutJsonRpcProvider } from './TimeoutJsonRpcProvider'

const apiKey = ''
export const privateKeys = [
    "",
    ""
]

const network = Network.Polygon
const isTestnet = false
const chainId = getChainId(network, isTestnet)

export function createSDK(privateKey?: string) {
    // @ts-ignore
    if (typeof (window) == 'object') {
        // browser
        return new ElementSDK({
            networkName: network,
            isTestnet: isTestnet,
            apiKey: apiKey,
            // @ts-ignore
            signer: new TimeoutWeb3Provider(window['ethereum'])
        })
    } else {
        // node.js
        // @ts-ignore
        const provider = new TimeoutJsonRpcProvider(RPC_URLS[chainId])
        const signer = new ethers.Wallet(privateKey as string, provider)
        return new ElementSDK({
            networkName: network,
            isTestnet: isTestnet,
            apiKey: apiKey,
            signer: signer
        })
    }
}
