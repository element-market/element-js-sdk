import { BatchSignedERC721OrderResponse } from './batchSignedTypes'
import { AssetSchema } from '../../types/types'

export function findOrderAsset(order: BatchSignedERC721OrderResponse): any {
    let startNonce = order.startNonce
    if (order.basicCollections != null) {
        for (const collection of order.basicCollections) {
            for (const item of collection.items) {
                if (order.nonce == startNonce) {
                    return {
                        erc20TokenAmount: item.erc20TokenAmount,
                        tokenAddress: collection.nftAddress,
                        schemaName: AssetSchema.ERC721,
                        tokenId: item.nftId,
                        collection: {
                            royaltyFeeAddress: collection.royaltyFeeRecipient,
                            royaltyFeePoints: collection.royaltyFee
                        }
                    }
                }
                startNonce++
            }
        }
    }
    
    if (order.collections != null) {
        for (const collection of order.collections) {
            for (const item of collection.items) {
                if (order.nonce == startNonce) {
                    return {
                        erc20TokenAmount: item.erc20TokenAmount,
                        tokenAddress: collection.nftAddress,
                        schemaName: AssetSchema.ERC721,
                        tokenId: item.nftId,
                        collection: {
                            royaltyFeeAddress: collection.royaltyFeeRecipient,
                            royaltyFeePoints: collection.royaltyFee
                        }
                    }
                }
                startNonce++
            }
        }
    }
}
