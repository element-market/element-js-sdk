import { createSDK, privateKeys } from './0.config'
import { AssetSchema, OrderSide, SaleKind } from '../src/types/types'
import { ethers } from 'ethers'

async function test() {
    const sdk0 = createSDK(privateKeys[0])
    const sdk1 = createSDK(privateKeys[1])
    
    // 1. makeBuyOrder
    const order = await sdk1.makeBuyOrder({
        assetId: '100001',
        assetAddress: '0x52e325E79820d8547798A2405d595020C75B713a',
        assetSchema: AssetSchema.ERC1155,
        quantity: 2000,
        paymentTokenAmount: ethers.utils.parseEther('0.02').toString()
    })
    console.log('order: ', order)
    
    // 2. test set quantity
    let tx = await sdk0.fillOrder({
        order: order,
        quantity: 500
    })
    console.log('tx.hash: ', tx.hash)
    let receipt = await tx.wait()
    console.log('completed， gasUsed: ', receipt.gasUsed.toString())
    
    // 3. test unset quantity
    tx = await sdk0.fillOrder({
        order: order
    })
    console.log('tx.hash: ', tx.hash)
    receipt = await tx.wait()
    console.log('completed， gasUsed: ', receipt.gasUsed.toString())
}

test()
    .then()
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
