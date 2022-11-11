import { createSDK, privateKeys } from './0.config'

async function test() {
    const sdk0 = createSDK(privateKeys[0])
    
    // 1. makeERC721SellOrders
    const r = await sdk0.makeERC721SellOrders({
        items: [{
            erc721TokenAddress: '0xd077bd42b79eB45F6eC24d025c6025B9749215CE',
            erc721TokenId: '15',
            paymentTokenAmount: 1e16
        }]
    })
    console.log("succeedList, ", r.succeedList)
    console.log("failedList, ", r.failedList)
    
    // 2. cancelOrder
    const tx = await sdk0.cancelOrder({
        order: r.succeedList[0]
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
