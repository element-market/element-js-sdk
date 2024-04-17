import { createSDK, privateKeys } from './0.config'

async function test() {
  const sdk0 = createSDK(privateKeys[0])
  
  // 1. cancel ElementEx
  const tx = await sdk0.cancelAllOrdersForSigner()
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
