import { createSDK, privateKeys } from './0.config'

async function test() {
    const sdk0 = createSDK(privateKeys[0])
    const sdk1 = createSDK(privateKeys[1])

    // 1. makeERC721SellOrders
    const r = await sdk0.makeERC721SellOrders({
        items: [
            {
                erc721TokenAddress: '0xd077bd42b79eB45F6eC24d025c6025B9749215CE',
                erc721TokenId: '10',
                paymentTokenAmount: 1e16
            }, {
                erc721TokenAddress: '0xd077bd42b79eB45F6eC24d025c6025B9749215CE',
                erc721TokenId: 11,
                paymentTokenAmount: '11000000000000000'
            }, {
                erc721TokenAddress: '0x051AF73Bc6feF83F4799014bd7A9F9Ad40a4Ad9F',
                erc721TokenId: '1',
                paymentTokenAmount: 1.3e16
            }, {
                erc721TokenAddress: '0x051AF73Bc6feF83F4799014bd7A9F9Ad40a4Ad9F',
                erc721TokenId: '2',
                paymentTokenAmount: 1.4e16
            }]
    })
    console.log("succeedList, ", r.succeedList)
    console.log("failedList, ", r.failedList)
    //
    // // 2. batchBuyWithETH
    // const tx = await sdk1.batchBuyWithETH({
    //     orders: r.succeedList
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
