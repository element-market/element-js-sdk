import { createSDK, privateKeys } from './0.config'
import { ethers } from 'ethers'

async function test() {
  // const sdk0 = createSDK(privateKeys[0])
  const sdk1 = createSDK(privateKeys[1])
  
  // 1. makeCollectionOffer
  const order = await sdk1.makeBuyOrder({
    assetAddress: '0x08f815B10573060d90e060a693dADF3391a3d930',
    paymentTokenAmount: ethers.utils.parseEther('0.003').toString()
  })
  console.log('order, ', order)
  //
  // // 2. fillOrder
  // const tx = await sdk0.fillOrder({
  //   order: order,
  //   assetId: '22'
  // })
  // console.log('tx.hash: ', tx.hash)
  // const receipt = await tx.wait()
  // console.log('completed， gasUsed: ', receipt.gasUsed.toString())
}

test()
  .then()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
