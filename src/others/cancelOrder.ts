import { GasParams } from '../types/types'
import { TransactionResponse } from '@ethersproject/abstract-provider'
import { LimitedCallSpec, Web3Signer } from '../signer/Web3Signer'
import { getLooksRareContract, getSeaportContract } from '../contracts/contracts'

export async function cancelSeaportOrders(signedOrders: any[], web3Signer: Web3Signer, gasParams: GasParams): Promise<TransactionResponse> {
    const orders: any [] = []
    for (const signedOrder of signedOrders) {
        orders.push(signedOrder.parameters)
    }
    
    const signer = await web3Signer.getSigner()
    const seaport = getSeaportContract(web3Signer.chainId, signer)
    const tx = await seaport.populateTransaction.cancel(orders)
    if (!tx?.data) {
        throw Error('cancelSeaportOrders failed, populateTransaction error.')
    }
    
    const from = await signer.getAddress()
    const call: LimitedCallSpec = {
        from: from,
        to: seaport.address,
        data: tx.data,
        gasPrice: gasParams.gasPrice,
        maxPriorityFeePerGas: gasParams.maxPriorityFeePerGas,
        maxFeePerGas: gasParams.maxFeePerGas
    }
    return web3Signer.ethSend(call)
}

export async function cancelAllSeaportOrders(web3Signer: Web3Signer, gasParams?: GasParams): Promise<TransactionResponse> {
    const signer = await web3Signer.getSigner()
    const seaport = getSeaportContract(web3Signer.chainId, signer)
    const tx = await seaport.populateTransaction.incrementCounter()
    if (!tx?.data) {
        throw Error('cancelAllSeaportOrders failed, populateTransaction error.')
    }
    
    const account = await signer.getAddress()
    const call: LimitedCallSpec = {
        from: account,
        to: seaport.address,
        data: tx.data,
        gasPrice: gasParams?.gasPrice,
        maxPriorityFeePerGas: gasParams?.maxPriorityFeePerGas,
        maxFeePerGas: gasParams?.maxFeePerGas
    }
    return web3Signer.ethSend(call)
}

export async function cancelLooksRareOrders(signedOrders: any[], web3Signer: Web3Signer, gasParams: GasParams): Promise<TransactionResponse> {
    const nonces: any [] = []
    for (const signedOrder of signedOrders) {
        nonces.push(signedOrder.nonce)
    }
    
    const signer = await web3Signer.getSigner()
    const looksRare = getLooksRareContract(web3Signer.chainId, signer)
    const tx = await looksRare.populateTransaction.cancelMultipleMakerOrders(nonces)
    if (!tx?.data) {
        throw Error('cancelLooksRareOrders failed, populateTransaction error.')
    }
    
    const account = await signer.getAddress()
    const call: LimitedCallSpec = {
        from: account,
        to: looksRare.address,
        data: tx.data,
        gasPrice: gasParams.gasPrice,
        maxPriorityFeePerGas: gasParams.maxPriorityFeePerGas,
        maxFeePerGas: gasParams.maxFeePerGas
    }
    return web3Signer.ethSend(call)
}

export async function cancelAllLooksRareOrders(web3Signer: Web3Signer, gasParams?: GasParams): Promise<TransactionResponse> {
    const signer = await web3Signer.getSigner()
    const account = await signer.getAddress()
    const looksRare = getLooksRareContract(web3Signer.chainId, signer)
    const minOrderNonce = await looksRare.userMinOrderNonce(account)
    const minNonce = minOrderNonce.add(499999)
    
    const tx = await looksRare.populateTransaction.cancelAllOrdersForSender(minNonce)
    if (!tx?.data) {
        throw Error('cancelAllSeaportOrders failed, populateTransaction error.')
    }
    const call: LimitedCallSpec = {
        from: account,
        to: looksRare.address,
        data: tx.data,
        gasPrice: gasParams?.gasPrice,
        maxPriorityFeePerGas: gasParams?.maxPriorityFeePerGas,
        maxFeePerGas: gasParams?.maxFeePerGas
    }
    return web3Signer.ethSend(call)
}
