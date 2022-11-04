import { BatchSignedERC721OrderResponse } from './batchSignedTypes'
import { Web3Signer } from '../../signer/Web3Signer'
import { BigNumber } from 'ethers'
import { ETH_TOKEN_ADDRESS, NULL_ADDRESS } from '../../types/types'
import { getElementExContract, getHelperContract } from '../../contracts/contracts'
import { CONTRACTS_ADDRESSES } from '../../contracts/config'
import { encodeBits } from '../../util/bitsUtil'
import { toContractERC20Token } from '../../util/tokenUtil'
import { toCollectionsBytesList } from '../../swap/encodeBatchSignedOrders'
import { findOrderAsset } from './batchSignedUtil'

const MASK_96 = '0xffffffffffffffffffffffff'

export async function fillBatchSignedOrder(order: BatchSignedERC721OrderResponse, taker: string, web3Signer: Web3Signer) {
    const asset = findOrderAsset(order)
    if (!asset) {
        throw Error('fillERC721SellOrder failed, findOrderAsset error, order: ' + order)
    }
    
    let value = '0'
    const paymentToken = order.paymentToken.toLowerCase()
    const isERC20 = (paymentToken != NULL_ADDRESS && paymentToken != ETH_TOKEN_ADDRESS)
    
    if (isERC20) {
        await approveERC20(paymentToken, asset.erc20TokenAmount, web3Signer)
    } else {
        value = asset.erc20TokenAmount
    }
    
    /// @param data1 [56 bits(startNonce) + 8 bits(v) + 32 bits(listingTime) + 160 bits(maker)]
    const data1 = encodeBits([
        [order.startNonce, 56],
        [order.v, 8],
        [order.listingTime, 32],
        [order.maker, 160]
    ])
    
    const takerPart1 = BigNumber.from(taker).shr(96).toHexString()
    const takerPart2 = BigNumber.from(taker).and(MASK_96).toHexString()
    
    /// @param data2 [64 bits(taker part1) + 32 bits(expiryTime) + 160 bits(erc20Token)]
    const data2 = encodeBits([
        [takerPart1, 64],
        [order.expirationTime, 32],
        [toContractERC20Token(paymentToken), 160]
    ])
    
    /// @param data3 [96 bits(taker part2) + 160 bits(platformFeeRecipient)]
    const data3 = encodeBits([
        [takerPart2, 96],
        [order.platformFeeRecipient, 160]
    ])
    
    const bytesList = toCollectionsBytesList(order, [order.nonce])
    if (!(bytesList?.bytesList && bytesList.bytesList.length == 1)) {
        throw Error('fillERC721SellOrder failed, toCollectionsBytesList error.')
    }
    
    const parameter: any = {
        data1: data1,
        data2: data2,
        data3: data3,
        r: encodeBits([[order.r, 256]]),
        s: encodeBits([[order.s, 256]])
    }
    const bytes = bytesList?.bytesList[0]
    
    const signer = await web3Signer.getSigner()
    const element = getElementExContract(web3Signer.chainId, signer)
    const data = await element.populateTransaction.fillBatchSignedERC721Order(parameter, bytes, {
        value: BigNumber.from(value)
    })
    return {
        data: data.data as any,
        value: BigNumber.from(value).toString()
    }
}

async function approveERC20(tokenAddress: string, value: string, web3Signer: Web3Signer) {
    if (BigNumber.from(value).eq(0)) {
        return
    }
    
    const chainId = web3Signer.chainId
    const signer = await web3Signer.getSigner()
    const owner = await signer.getAddress()
    const elementEx = CONTRACTS_ADDRESSES[chainId].ElementEx
    const helper = getHelperContract(chainId, signer)
    
    const infos = await helper.checkAssetsEx(owner, elementEx, ['2'], [tokenAddress], ['0'])
    const info = infos[0]
    if (info.balance.lt(value)) {
        throw Error('fillERC721SellOrder failed, Not enough erc20 balance.')
    }
    
    if (info.allowance.lt(value)) {
        const tx = await web3Signer.approveERC20Proxy(owner, tokenAddress, elementEx)
        await tx.wait()
    }
}
