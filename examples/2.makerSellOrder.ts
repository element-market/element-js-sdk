import { createSDK, privateKeys } from './0.config'
import { AssetSchema } from '../src/types/types'
import { ethers } from 'ethers'

async function test() {
  const sdk0 = createSDK(privateKeys[0])
  // const sdk1 = createSDK(privateKeys[1])
  
  // 1. makeSellOrder
  const order = await sdk0.makeSellOrder({
    assetId: '100001',
    assetAddress: '0x5EeBA0369D80092d9770395D3B8592FAB9cD7199',
    assetSchema: AssetSchema.ERC1155,
    quantity: 100,
    paymentTokenAmount: ethers.utils.parseEther('0.002').toString()
  })
  console.log('order: ', order)
  //
  // // 2. batchBuyWithETH
  // const tx = await sdk1.batchBuyWithETH({
  //   orders: [ order ],
  //   quantities: [ 50 ]
  // })
  // console.log('tx.hash: ', tx.hash)
  // const receipt = await tx.wait()
  // console.log('completed， gasUsed: ', receipt.gasUsed.toString())
  //
  // // 3. getBoughtAssets
  // const assets = sdk1.getBoughtAssets(receipt)
  // console.log('assets: ', assets)
}

test()
  .then()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
