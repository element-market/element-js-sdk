import { createSDK, privateKeys } from './0.config'
import { ethers } from 'ethers'

async function test() {
    const sdk0 = createSDK(privateKeys[0])
    const sdk1 = createSDK(privateKeys[1])
    
    // 1. makeCollectionOffer
    const order = await sdk1.makeBuyOrder({
        assetAddress: '0x5D1feadF92dF113d810d944229464544Ab9B930c',
        paymentTokenAmount: ethers.utils.parseEther('0.03').toString()
    })
    console.log('order, ', JSON.stringify(order))
    
    // 2. fillOrder
    const tx = await sdk0.fillOrder({
        order: order,
        assetId: '10'
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
