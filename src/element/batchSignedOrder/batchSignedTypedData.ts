import { toContractERC20Token } from '../../util/tokenUtil'
import { BatchSignedERC721Order } from './batchSignedTypes'
import { encodeBits } from '../../util/bitsUtil'

const BATCH_SIGNED_ERC721_ORDERS_ABI = [
    { type: 'address', name: 'maker' },
    { type: 'uint256', name: 'listingTime' },
    { type: 'uint256', name: 'expiryTime' },
    { type: 'uint256', name: 'startNonce' },
    { type: 'address', name: 'erc20Token' },
    { type: 'address', name: 'platformFeeRecipient' },
    { type: 'BasicCollection[]', name: 'basicCollections' },
    { type: 'Collection[]', name: 'collections' },
    { type: 'uint256', name: 'hashNonce' }
]

const BASIC_COLLECTION_ABI = [
    { type: 'address', name: 'nftAddress' },
    { type: 'bytes32', name: 'fee' },
    { type: 'bytes32[]', name: 'items' }
]

const COLLECTION_ABI = [
    { type: 'address', name: 'nftAddress' },
    { type: 'bytes32', name: 'fee' },
    { type: 'OrderItem[]', name: 'items' }
]

const ORDER_ITEM_ABI = [
    { type: 'uint256', name: 'erc20TokenAmount' },
    { type: 'uint256', name: 'nftId' }
]

export function getTypedData(order: BatchSignedERC721Order, chainId: number): any {
    return {
        types: {
            ['BatchSignedERC721Orders']: BATCH_SIGNED_ERC721_ORDERS_ABI,
            ['BasicCollection']: BASIC_COLLECTION_ABI,
            ['Collection']: COLLECTION_ABI,
            ['OrderItem']: ORDER_ITEM_ABI
        },
        domain: {
            name: 'ElementEx',
            version: '1.0.0',
            chainId: chainId,
            verifyingContract: order.exchange
        },
        primaryType: 'BatchSignedERC721Orders',
        message: toStandardOrder(order)
    }
}

function toStandardOrder(order: BatchSignedERC721Order): any {
    return {
        maker: order.maker,
        listingTime: order.listingTime,
        expiryTime: order.expirationTime,
        startNonce: order.startNonce,
        erc20Token: toContractERC20Token(order.paymentToken),
        platformFeeRecipient: order.platformFeeRecipient,
        basicCollections: toStandardBasicCollections(order),
        collections: toStandardCollections(order),
        hashNonce: order.hashNonce
    }
}

function toStandardBasicCollections(order: BatchSignedERC721Order) {
    const basicCollections: any[] = []
    if (order.basicCollections != null) {
        for (const collection of order.basicCollections) {
            const items: string[] = []
            if (collection.items) {
                for (const item of collection.items) {
                    /// @param item [96 bits(erc20TokenAmount) + 160 bits(nftId)].
                    items.push(encodeBits([
                        [item.erc20TokenAmount, 96],
                        [item.nftId, 160]
                    ]))
                }
            }
            basicCollections.push({
                nftAddress: collection.nftAddress,
                /// @param fee [16 bits(platformFeePercentage) + 16 bits(royaltyFeePercentage) + 160 bits(royaltyFeeRecipient)].
                fee: encodeBits([
                    [0, 64],
                    [collection.platformFee, 16],
                    [collection.royaltyFee, 16],
                    [collection.royaltyFeeRecipient, 160]
                ]),
                items: items
            })
        }
    }
    return basicCollections
}

function toStandardCollections(order: BatchSignedERC721Order) {
    const collections: any[] = []
    if (order.collections != null) {
        for (const collection of order.collections) {
            const items: any[] = []
            if (collection.items) {
                items.push(...collection.items)
            }
            collections.push({
                nftAddress: collection.nftAddress,
                /// @param fee [16 bits(platformFeePercentage) + 16 bits(royaltyFeePercentage) + 160 bits(royaltyFeeRecipient)].
                fee: encodeBits([
                    [0, 64],
                    [collection.platformFee, 16],
                    [collection.royaltyFee, 16],
                    [collection.royaltyFeeRecipient, 160]
                ]),
                items: items
            })
        }
    }
    return collections
}
