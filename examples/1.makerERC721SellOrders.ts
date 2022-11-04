import { createSDK, privateKeys } from './0.config'

async function test() {
    const sdk0 = createSDK(privateKeys[0])
    const sdk1 = createSDK(privateKeys[1])

    // 1. makeERC721SellOrders
    const r = await sdk0.makeERC721SellOrders({
        items: [
            {
            erc721TokenAddress: '0x5D1feadF92dF113d810d944229464544Ab9B930c',
            erc721TokenId: '1',
            paymentTokenAmount: 1e16
        }, {
            erc721TokenAddress: '0x5D1feadF92dF113d810d944229464544Ab9B930c',
            erc721TokenId: 2,
            paymentTokenAmount: '12000000000000000'
        },
            {
            erc721TokenAddress: '0xCF09Aba56f36a4521094c3bF6A303262636B2e1A',
            erc721TokenId: '320',
            paymentTokenAmount: 1.2e16
        }]
    })
    console.log("succeedList, ", r.succeedList)
    console.log("failedList, ", r.failedList)

    // 2. batchBuyWithETH
    const tx = await sdk1.batchBuyWithETH({
        orders: r.succeedList
    })
    console.log('tx.hash: ', tx.hash)
    const receipt = await tx.wait(1)
    console.log('completed， gasUsed: ', receipt.gasUsed.toString())
}

test()
    .then()
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
