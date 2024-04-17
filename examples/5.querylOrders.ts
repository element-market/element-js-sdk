import { createSDK, privateKeys } from './0.config'
import { NULL_ADDRESS } from '../src/types/types'

async function test() {
  const sdk1 = createSDK(privateKeys[1])
  
  // 1. query element orders
  const orders = await sdk1.queryOrders({
    asset_contract_address: '0xd077bd42b79eB45F6eC24d025c6025B9749215CE',
    payment_token: NULL_ADDRESS
  })
  console.log('orders, ', orders)
  
  // 2. batchBuyWithETH
  const tx = await sdk1.batchBuyWithETH({
    orders: [ orders[0] ]
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
