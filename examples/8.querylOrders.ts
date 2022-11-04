import { createSDK, privateKeys } from './0.config'
import { NULL_ADDRESS } from '../lib'

async function test() {
    const sdk1 = createSDK(privateKeys[1])
    
    // 1. query element orders
    const orders = await sdk1.queryOrders({
        asset_contract_address: '0x9FDc7D60826A9b6979051Cb79ED9A9626390aD8e',
        payment_token: NULL_ADDRESS,
    })
    console.log("orders, ", orders)
    
    // 2. batchBuyWithETH
    const tx = await sdk1.batchBuyWithETH({
        orders: [orders[0]]
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
