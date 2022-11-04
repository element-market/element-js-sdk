import { createSDK, privateKeys } from './0.config'
import { AssetSchema } from '../src/types/types'
import { ethers } from 'ethers'

async function test() {
    const sdk0 = createSDK(privateKeys[0])
    const sdk1 = createSDK(privateKeys[1])
    
    // 1. makeSellOrder
    const order = await sdk0.makeSellOrder({
        assetId: '100001',
        assetAddress: '0x52e325E79820d8547798A2405d595020C75B713a',
        assetSchema: AssetSchema.ERC1155,
        quantity: 1000,
        paymentTokenAmount: ethers.utils.parseEther('0.02').toString()
    })
    console.log(order)

    // 2. batchBuyWithETH
    const tx = await sdk1.batchBuyWithETH({
        orders: [order]
    })
    console.log('tx.hash: ', tx.hash)
    const receipt = await tx.wait()
    console.log('completed， gasUsed: ', receipt.gasUsed.toString())
}

test()
    .then()
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
