import { createSDK, privateKeys } from './0.config'

async function test() {
    const sdk0 = createSDK(privateKeys[0])
    
    // 1. makeERC721SellOrders
    const r = await sdk0.makeERC721SellOrders({
        items: [{
            erc721TokenAddress: '0x5D1feadF92dF113d810d944229464544Ab9B930c',
            erc721TokenId: '6',
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
