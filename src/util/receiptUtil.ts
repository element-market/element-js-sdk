import { TransactionReceipt } from '@ethersproject/abstract-provider'
import { Asset, AssetSchema } from '../types/types'
import { BigNumber } from 'ethers'

const BYTE32_0 = '0x0000000000000000000000000000000000000000000000000000000000000000'
const topicTransfer = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
const topicTransferSingle = '0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62'

export function getBoughtAssets(receipt: TransactionReceipt): Array<Asset> {
    if (!receipt.from || !receipt.logs) {
        return []
    }
    
    const list: Asset[] = []
    const from = receipt.from.toLowerCase()
    for (const log of receipt.logs) {
        if (
            log.topics?.length == 4 &&
            log.topics[0].toLowerCase() == topicTransfer &&
            log.topics[1].toLowerCase() != BYTE32_0 &&
            BigNumber.from(log.topics[2].toLowerCase()).eq(from)
        ) {
            list.push({
                assetId: BigNumber.from(log.topics[3]).toString(),
                assetAddress: log.address.toLowerCase(),
                assetSchema: AssetSchema.ERC721,
                quantity: '1'
            })
            continue
        }
        
        if (
            log.topics?.length == 4 &&
            log.data?.length == 130 &&
            log.topics[0].toLowerCase() == topicTransferSingle &&
            log.topics[2].toLowerCase() != BYTE32_0 &&
            BigNumber.from(log.topics[3].toLowerCase()).eq(from)
        ) {
            list.push({
                assetId: BigNumber.from(log.data.substring(0, 66)).toString(),
                assetAddress: log.address.toLowerCase(),
                assetSchema: AssetSchema.ERC721,
                quantity: BigNumber.from('0x' + log.data.substring(66)).toString()
            })
        }
    }
    return list
}
