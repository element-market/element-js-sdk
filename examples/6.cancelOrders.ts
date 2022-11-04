import { createSDK, privateKeys } from './0.config'
import { AssetSchema } from '../src/types/types'
import { ethers } from 'ethers'

const sdk0 = createSDK(privateKeys[0])

async function test() {
    const account = await sdk0.web3Signer.getCurrentAccount()

    // 1. createOrders and queryOrders
    await createOrders()
    let orders = await sdk0.queryOrders({
        maker: account
    })
    console.log('orders, ', orders)

    // 2. cancelOrders
    const r = await sdk0.cancelOrders({
        orders: orders
    })
    for (const item of r.succeedTransactions) {
        console.log('orders: ', item.orders)
        console.log('tx.hash: ', item.transaction.hash)
        const receipt = await item.transaction.wait()
        console.log('completed， receipt: ', receipt.gasUsed.toString())
    }

}

async function createOrders() {
    await sdk0.makeERC721SellOrders({
        items: [{
            erc721TokenAddress: '0x5D1feadF92dF113d810d944229464544Ab9B930c',
            erc721TokenId: '11',
            paymentTokenAmount: 1e16
        }, {
            erc721TokenAddress: '0x5D1feadF92dF113d810d944229464544Ab9B930c',
            erc721TokenId: '12',
            paymentTokenAmount: '12000000000000000'
        }, {
            erc721TokenAddress: '0xCF09Aba56f36a4521094c3bF6A303262636B2e1A',
            erc721TokenId: '315',
            paymentTokenAmount: 1.2e16
        }]
    })
    await sdk0.makeSellOrder({
        assetId: '100001',
        assetAddress: '0x52e325E79820d8547798A2405d595020C75B713a',
        assetSchema: AssetSchema.ERC1155,
        quantity: 1000,
        paymentTokenAmount: ethers.utils.parseEther('0.02').toString()
    })
}

test()
    .then()
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
