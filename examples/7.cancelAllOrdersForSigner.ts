import { createSDK, privateKeys } from './0.config'
import { Standard } from '../src/types/types'

async function test() {
    const sdk0 = createSDK(privateKeys[0])
    let tx
    let receipt
    
    // 1. cancel ElementEx
    tx = await sdk0.cancelAllOrdersForSigner({
        standard: Standard.ElementEx
    })
    console.log('tx.hash: ', tx.hash)
    receipt = await tx.wait()
    console.log('completed， gasUsed: ', receipt.gasUsed.toString())
    
    // 2. cancel Seaport
    tx = await sdk0.cancelAllOrdersForSigner({
        standard: Standard.Seaport
    })
    console.log('tx.hash: ', tx.hash)
    receipt = await tx.wait()
    console.log('completed， gasUsed: ', receipt.gasUsed.toString())
    
    // 3. cancel LooksRare
    tx = await sdk0.cancelAllOrdersForSigner({
        standard: Standard.LooksRare
    })
    console.log('tx.hash: ', tx.hash)
    receipt = await tx.wait()
    console.log('completed， gasUsed: ', receipt.gasUsed.toString())
}


test()
    .then()
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
