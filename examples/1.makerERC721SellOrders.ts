import { createSDK, privateKeys } from './0.config'
import { ethers } from 'ethers'

async function test() {
  const sdk0 = createSDK(privateKeys[0])
  // const sdk1 = createSDK(privateKeys[1])
  
  // 1. makeERC721SellOrders
  const r = await sdk0.makeERC721SellOrders({
    items: [
      {
        erc721TokenAddress: '0x08f815B10573060d90e060a693dADF3391a3d930',
        erc721TokenId: '23',
        paymentTokenAmount: ethers.utils.parseEther('0.002').toString()
      }, {
        erc721TokenAddress: '0x08f815B10573060d90e060a693dADF3391a3d930',
        erc721TokenId: '24',
        paymentTokenAmount: ethers.utils.parseEther('0.003').toString()
      }
    ]
  })
  console.log('succeedList, ', r.succeedList)
  console.log('failedList, ', r.failedList)
  //
  // // 2. batchBuyWithETH
  // const tx = await sdk1.batchBuyWithETH({
  //   orders: r.succeedList
  // })
  // console.log('tx.hash: ', tx.hash)
  // const receipt = await tx.wait(1)
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
