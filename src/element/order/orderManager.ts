import { LimitedCallSpec, Web3Signer } from '../../signer/Web3Signer'
import { getElementExContract, getHelperContract } from '../../contracts/contracts'
import { CONTRACTS_ADDRESSES } from '../../contracts/config'
import { BigNumber, Contract, ethers } from 'ethers'
import {
    CreateOrderParams,
    DEFAULT_EXPIRATION_TIME,
    ERC1155Order,
    ERC721Order,
    Fee,
    FillParams,
    MAX_EXPIRATION_TIME,
    MAX_LISTING_TIME,
    SignatureType,
    SignedOrder
} from './orderTypes'
import { AssetSchema, ETH_TOKEN_ADDRESS, GasParams, NULL_ADDRESS, SaleKind } from '../../types/types'
import { toContractERC20Token, toStandardERC20Token } from '../../util/tokenUtil'
import { getOrderTypedData } from './orderTypedData'
import { encodeBits } from '../../util/bitsUtil'
import { TransactionResponse } from '@ethersproject/abstract-provider'
import { encodeBasicOrders } from '../../swap/encodeBasicOrders'

const MASK_96 = '0xffffffffffffffffffffffff'

export class OrderManager {
    
    public web3Signer: Web3Signer
    public elementEx: Contract
    public helper: Contract
    public WETH: string
    
    constructor(web3Signer: Web3Signer) {
        this.web3Signer = web3Signer
        this.elementEx = getElementExContract(web3Signer.chainId)
        this.helper = getHelperContract(web3Signer.chainId)
        this.WETH = CONTRACTS_ADDRESSES[web3Signer.chainId].WToken
    }
    
    public async createSellOrder(params: CreateOrderParams, gasParams: GasParams): Promise<ERC721Order | ERC1155Order> {
        const expiry = getOrderExpiry(params)
        const fees = calcFees(params)
        const erc20TokenAmount = calcERC20TokenAmount(params, fees)
        const order: any = {
            maker: params.makerAddress.toLowerCase(),
            taker: params.takerAddress.toLowerCase(),
            expiry: expiry,
            nonce: BigNumber.from(params.nonce).toString(),
            erc20Token: toContractERC20Token(params.paymentToken),
            erc20TokenAmount: erc20TokenAmount,
            fees: fees
        }
        
        switch (params.asset.schema) {
            case AssetSchema.ERC721:
                order.nft = params.asset.address.toLowerCase()
                order.nftId = BigNumber.from(params.asset.id).toString()
                break
            case AssetSchema.ERC1155:
                order.erc1155Token = params.asset.address.toLowerCase()
                order.erc1155TokenId = BigNumber.from(params.asset.id).toString()
                order.erc1155TokenAmount = BigNumber.from(params.quantity).toString()
                break
            default:
                throw Error('createSellOrder failed, unsupported schema : ' + params.asset.schema)
        }
        await this.checkAndApproveSellOrder(order, gasParams)
        return order
    }
    
    public async createBuyOrder(params: CreateOrderParams, gasParams: GasParams): Promise<ERC721Order | ERC1155Order> {
        const expiry = getOrderExpiry(params)
        const fees = calcFees(params)
        const erc20TokenAmount = calcERC20TokenAmount(params, fees)
        const paymentToken = params.paymentToken ? params.paymentToken : this.WETH
        
        const order: any = {
            maker: params.makerAddress.toLowerCase(),
            taker: params.takerAddress.toLowerCase(),
            expiry: expiry,
            nonce: BigNumber.from(params.nonce).toString(),
            erc20Token: toContractERC20Token(paymentToken),
            erc20TokenAmount: erc20TokenAmount,
            fees: fees
        }
        
        const { tokenId, properties } = getBuyOrderTokenIdAndProperties(params)
        switch (params.asset.schema) {
            case AssetSchema.ERC721:
                order.nft = params.asset.address.toLowerCase()
                order.nftId = tokenId
                order.nftProperties = properties
                break
            case AssetSchema.ERC1155:
                order.erc1155Token = params.asset.address.toLowerCase()
                order.erc1155TokenId = tokenId
                order.erc1155TokenAmount = BigNumber.from(params.quantity).toString()
                order.erc1155TokenProperties = properties
                break
            default:
                throw Error('createBuyOrder failed, unsupported schema : ' + params.asset.schema)
        }
        
        await this.checkAndApproveBuyOrder(order, gasParams)
        return order
    }
    
    public async signOrder(order: any): Promise<SignedOrder> {
        const chainId = this.web3Signer.chainId
        const typedData = getOrderTypedData(order, chainId)
        const signature = await this.web3Signer.signTypedData(order.maker, typedData)
        const orderHash = Web3Signer.getOrderHash(typedData)
        return {
            chainId: chainId,
            order: order,
            signature: {
                signatureType: SignatureType.EIP712,
                v: signature.v,
                r: signature.r,
                s: signature.s
            },
            orderHash: orderHash
        }
    }
    
    public async fillOrder(params: FillParams, gasParams: GasParams): Promise<TransactionResponse> {
        const order = params.order
        const sig = params.signature
        
        let data, value
        if (order['nft'] != null) {
            // ERC721Order
            const { tokenId, payValue } = await this.checkAndApproveFillERC721Order(params, gasParams)
            if (order['nftProperties'] != null) {
                // sellERC721
                const unwrapNativeToken = order.erc20Token.toLowerCase() == this.WETH.toLowerCase()
                const tx = await this.elementEx.populateTransaction.sellERC721(order, sig, tokenId, unwrapNativeToken, '0x')
                data = tx?.data
            } else {
                // buyERC721
                if (params.saleKind == SaleKind.FixedPrice) {
                    if (
                        toStandardERC20Token(params.order.erc20Token) == NULL_ADDRESS &&
                        BigNumber.from(params.order.erc20TokenAmount).lte(MASK_96)
                    ) {
                        const tradeDatas = await encodeBasicOrders([params], params.takerAddress, 0)
                        if (tradeDatas?.length == 1) {
                            data = tradeDatas[0].data
                        }
                    } else {
                        const tx = await this.elementEx.populateTransaction.buyERC721(order, sig, params.takerAddress)
                        data = tx?.data
                    }
                } else {
                    const tx = await this.elementEx.populateTransaction.buyERC721Ex(order, sig, params.takerAddress, '0x')
                    data = tx?.data
                }
                value = payValue
            }
        } else if (order['erc1155Token'] != null) {
            // ERC1155Order
            const { tokenId, payValue, quantity } = await this.checkAndApproveFillERC1155Order(params, gasParams)
            if (order['erc1155TokenProperties'] != null) {
                // sellERC1155
                const unwrapNativeToken = order.erc20Token.toLowerCase() == this.WETH.toLowerCase()
                const tx = await this.elementEx.populateTransaction.sellERC1155(order, sig, tokenId, quantity, unwrapNativeToken, '0x')
                data = tx?.data
            } else {
                // buyERC1155
                if (params.saleKind == SaleKind.FixedPrice) {
                    const tx = await this.elementEx.populateTransaction.buyERC1155(order, sig, params.takerAddress, quantity)
                    data = tx?.data
                } else {
                    const tx = await this.elementEx.populateTransaction.buyERC1155Ex(order, sig, params.takerAddress, quantity, '0x')
                    data = tx?.data
                }
                value = payValue
            }
        } else {
            throw Error('fillOrder failed, unsupported order.')
        }
        
        if (!data) {
            throw Error('fillOrder, populateTransaction failed.')
        }
        
        const from = await this.web3Signer.getCurrentAccount()
        const call: LimitedCallSpec = {
            from: from,
            to: this.elementEx.address,
            data: data,
            value: value,
            gasPrice: gasParams.gasPrice,
            maxPriorityFeePerGas: gasParams.maxPriorityFeePerGas,
            maxFeePerGas: gasParams.maxFeePerGas
        }
        return this.web3Signer.ethSend(call)
    }
    
    public async cancelERC721Orders(signedOrders: any[], gasParams: GasParams): Promise<TransactionResponse> {
        const nonces: any [] = []
        for (const signedOrder of signedOrders) {
            nonces.push(signedOrder.order ? signedOrder.order.nonce : signedOrder.nonce)
        }
        
        const tx = await this.elementEx.populateTransaction.batchCancelERC721Orders(nonces)
        if (!tx?.data) {
            throw Error('cancelOrder failed, populateTransaction error.')
        }
        const from = await this.web3Signer.getCurrentAccount()
        const call: LimitedCallSpec = {
            from: from,
            to: this.elementEx.address,
            data: tx.data,
            gasPrice: gasParams.gasPrice,
            maxPriorityFeePerGas: gasParams.maxPriorityFeePerGas,
            maxFeePerGas: gasParams.maxFeePerGas
        }
        return this.web3Signer.ethSend(call)
    }
    
    public async cancelERC1155Orders(signedOrders: any[], gasParams: GasParams): Promise<TransactionResponse> {
        const nonces: any [] = []
        for (const signedOrder of signedOrders) {
            nonces.push(signedOrder.order.nonce)
        }
        const tx = await this.elementEx.populateTransaction.batchCancelERC1155Orders(nonces)
        if (!tx?.data) {
            throw Error('cancelOrder failed, populateTransaction error.')
        }
        const from = await this.web3Signer.getCurrentAccount()
        const call: LimitedCallSpec = {
            from: from,
            to: this.elementEx.address,
            data: tx.data,
            gasPrice: gasParams.gasPrice,
            maxPriorityFeePerGas: gasParams.maxPriorityFeePerGas,
            maxFeePerGas: gasParams.maxFeePerGas
        }
        return this.web3Signer.ethSend(call)
    }
    
    public async cancelAllOrders(gasParams?: GasParams): Promise<TransactionResponse> {
        const tx = await this.elementEx.populateTransaction.incrementHashNonce()
        if (!tx?.data) {
            throw Error('cancelAllOrders failed, populateTransaction error.')
        }
        
        const from = await this.web3Signer.getCurrentAccount()
        const call: LimitedCallSpec = {
            from: from,
            to: this.elementEx.address,
            data: tx.data,
            gasPrice: gasParams?.gasPrice,
            maxPriorityFeePerGas: gasParams?.maxPriorityFeePerGas,
            maxFeePerGas: gasParams?.maxFeePerGas
        }
        return this.web3Signer.ethSend(call)
    }
    
    private async checkAndApproveSellOrder(order: ERC721Order | ERC1155Order, gasParams: GasParams) {
        const isERC721Order = order['nft'] != null
        const r = isERC721Order
            ? await this.helper.checkERC721SellOrder(order, NULL_ADDRESS)
            : await this.helper.checkERC1155SellOrder(order, NULL_ADDRESS, '0')
        
        if (r.info.success) {
            order.hashNonce = r.info.hashNonce.toString()
            return
        }
        if (!r.info.makerCheck) {
            throw Error('createSellOrder failed, makerCheck error.')
        }
        if (!r.info.takerCheck) {
            throw Error('createSellOrder failed, takerCheck error.')
        }
        if (!r.info.listingTimeCheck) {
            throw Error('createSellOrder failed, listingTimeCheck error.')
        }
        if (!r.info.expireTimeCheck) {
            throw Error('createSellOrder failed, expireTimeCheck error.')
        }
        if (!r.info.extraCheck) {
            throw Error('createSellOrder failed, extraCheck error.')
        }
        if (!r.info.feesCheck) {
            throw Error('createSellOrder failed, feesCheck error.')
        }
        if (!r.info.nonceCheck) {
            throw Error('createSellOrder failed, nonceCheck error, please try again.')
        }
        if (!r.info.erc20AddressCheck) {
            throw Error('createSellOrder failed, erc20AddressCheck error.')
        }
        if (isERC721Order) {
            if (!r.info.erc721OwnerCheck) {
                throw Error(`createSellOrder, erc721OwnerCheck failed, make sure account(${order.maker}) is owner of assetId(${order['nftId']}).`)
            }
            if (!r.info.erc721ApprovedCheck) {
                const tx = await this.web3Signer.approveERC721Proxy(order.maker, order['nft'], this.elementEx.address, gasParams)
                await tx.wait()
            }
        } else {
            if (order['erc1155TokenAmount'] == null || BigNumber.from(order['erc1155TokenAmount']).lt('1')) {
                throw Error('createSellOrder, quantityCheck failed, erc1155 should set quantity.')
            }
            if (!r.info.remainingAmountCheck) {
                throw Error('createSellOrder, remainingAmountCheck failed, please try again.')
            }
            if (!r.info.erc1155BalanceCheck) {
                throw Error(`createSellOrder, erc1155BalanceCheck failed, account(${order.maker}), require erc1155Balance >= quantity`)
            }
            if (!r.info.erc1155ApprovedCheck) {
                const tx = await this.web3Signer.approveERC1155Proxy(order.maker, order['erc1155Token'], this.elementEx.address, gasParams)
                await tx.wait()
            }
        }
    }
    
    private async checkAndApproveBuyOrder(order: ERC721Order | ERC1155Order, gasParams: GasParams) {
        const isERC721Order = order['nft'] != null
        const r = isERC721Order
            ? await this.helper.checkERC721BuyOrder(order, NULL_ADDRESS, '0')
            : await this.helper.checkERC1155BuyOrder(order, NULL_ADDRESS, '0', '0')
        
        if (r.info.success) {
            order.hashNonce = r.info.hashNonce.toString()
            return
        }
        if (!r.info.makerCheck) {
            throw Error('createBuyOrder, makerCheck failed.')
        }
        if (!r.info.takerCheck) {
            throw Error('createBuyOrder, takerCheck failed.')
        }
        if (!r.info.listingTimeCheck) {
            throw Error('createBuyOrder, listingTimeCheck failed.')
        }
        if (!r.info.expireTimeCheck) {
            throw Error('createBuyOrder, expireTimeCheck failed.')
        }
        if (!r.info.feesCheck) {
            throw Error('createBuyOrder, feesCheck failed.')
        }
        if (!r.info.nonceCheck) {
            throw Error('createBuyOrder, nonceCheck failed, please try again.')
        }
        if (!r.info.erc20AddressCheck) {
            throw Error('createBuyOrder, erc20AddressCheck failed, should be ERC20 address, can not be native address.')
        }
        if (!r.info.propertiesCheck) {
            throw Error('createBuyOrder, propertiesCheck failed.')
        }
        if (!isERC721Order) {
            if (order['erc1155TokenAmount'] == null || BigNumber.from(order['erc1155TokenAmount']).lt('1')) {
                throw Error('createBuyOrder, quantityCheck failed, quantity: ' + order['erc1155TokenAmount'])
            }
            if (!r.info.remainingAmountCheck) {
                throw Error('createBuyOrder, remainingAmountCheck failed, please try again.')
            }
        }
        if (!r.info.erc20BalanceCheck) {
            throw Error(`createBuyOrder, erc20BalanceCheck failed, make sure account${order.maker} have enough balance of erc20Token(${order.erc20Token}).`)
        }
        if (!r.info.erc20AllowanceCheck && order.erc20Token.toLowerCase() != ETH_TOKEN_ADDRESS) {
            const tx = await this.web3Signer.approveERC20Proxy(order.maker, order.erc20Token, this.elementEx.address, gasParams)
            await tx.wait(1)
        }
    }
    
    private async checkAndApproveFillERC721Order(params: FillParams, gasParams: GasParams) {
        const order = params.order as ERC721Order
        const takerAddress = params.takerAddress
        let assetId = params.assetId
        let payValue = '0'
        
        if (order.nftProperties != null) {
            if (!assetId) {
                if (order.nftProperties.length > 0) {
                    throw Error('fillOrder failed, fill the collectionOfferOrder must set assetId.')
                }
                assetId = order.nftId
            }
            
            const r = await this.helper.checkERC721BuyOrder(order, takerAddress, assetId)
            if (!r.info.nonceCheck) {
                throw Error('fillOrder failed, the ERC721BuyOrder has filled.')
            }
            if (!r.info.expireTimeCheck) {
                throw Error('fillOrder failed, the ERC721BuyOrder has expired.')
            }
            if (!r.takerCheckInfo.erc721OwnerCheck) {
                throw Error(`fillOrder failed, make sure account(${takerAddress}) is owner of assetId(${assetId}).`)
            }
            if (!r.takerCheckInfo.erc721ApprovedCheck) {
                const tx = await this.web3Signer.approveERC721Proxy(takerAddress, order.nft, this.elementEx.address, gasParams)
                await tx.wait()
            }
        } else {
            if (assetId && assetId != order.nftId) {
                throw Error('fillOrder failed, assetId mismatch the ERC721SellOrder.nftId.')
            }
            assetId = order.nftId
            
            const r = await this.helper.checkERC721SellOrder(order, takerAddress)
            if (!r.info.nonceCheck) {
                throw Error('fillOrder failed, the ERC721SellOrder has filled.')
            }
            if (!r.info.expireTimeCheck) {
                throw Error('fillOrder failed, the ERC721SellOrder has expired.')
            }
            if (!r.takerCheckInfo.balanceCheck) {
                throw Error(`fillOrder failed, make sure account${takerAddress} have enough balance of erc20Token(${order.erc20Token}).`)
            }
            if (!r.takerCheckInfo.allowanceCheck && order.erc20Token.toLowerCase() != ETH_TOKEN_ADDRESS) {
                const tx = await this.web3Signer.approveERC20Proxy(takerAddress, order.erc20Token, this.elementEx.address, gasParams)
                await tx.wait()
            }
            if (order.erc20Token.toLowerCase() != ETH_TOKEN_ADDRESS) {
                payValue = r.info.erc20TotalAmount.toString()
            }
        }
        return { tokenId: assetId, payValue: payValue }
    }
    
    private async checkAndApproveFillERC1155Order(params: FillParams, gasParams: GasParams) {
        const order = params.order as ERC1155Order
        const takerAddress = params.takerAddress
        let assetId = params.assetId
        let payValue = '0'
        let quantity
        
        // fill ERC1155BuyOrder
        if (order.erc1155TokenProperties != null) {
            if (!assetId) {
                if (order.erc1155TokenProperties.length > 0) {
                    throw Error('fillOrder failed, fill the collectionOfferOrder should set assetId.')
                }
                assetId = order.erc1155TokenId
            }
            
            const r = await this.helper.checkERC1155BuyOrder(order, takerAddress, assetId, '0')
            if (!r.info.nonceCheck) {
                throw Error('fillOrder failed, the ERC1155BuyOrder has filled.')
            }
            if (!r.info.expireTimeCheck) {
                throw Error('fillOrder failed, the ERC1155BuyOrder has expired.')
            }
            
            if (params.quantity) {
                quantity = params.quantity
                if (BigNumber.from(quantity).gt(r.info.erc1155RemainingAmount)) {
                    throw Error(`fillOrder failed, require quantity <= erc1155RemainingAmount(${r.info.erc1155RemainingAmount.toString()}).`)
                }
                if (BigNumber.from(quantity).gt(r.takerCheckInfo.erc1155Balance)) {
                    throw Error(`fillOrder failed, require quantity <= erc1155Balance(${r.takerCheckInfo.erc1155Balance.toString()}).`)
                }
            } else {
                if (r.info.erc1155RemainingAmount.lt(r.takerCheckInfo.erc1155Balance)) {
                    quantity = r.info.erc1155RemainingAmount.toString()
                } else {
                    quantity = r.takerCheckInfo.erc1155Balance.toString()
                }
            }
            if (BigNumber.from(quantity).lt('1')) {
                throw Error('fillOrder failed, fill 1155 order must set quantity.')
            }
            
            if (!r.takerCheckInfo.erc1155ApprovedCheck) {
                const tx = await this.web3Signer.approveERC1155Proxy(takerAddress, order.erc1155Token, this.elementEx.address, gasParams)
                await tx.wait()
            }
        } else {
            // fill ERC1155SellOrder
            if (assetId && assetId != order.erc1155TokenId) {
                throw Error('fillOrder failed, assetId mismatch the ERC1155SellOrder.erc1155TokenId')
            }
            assetId = order.erc1155TokenId
            
            const r = await this.helper.checkERC1155SellOrder(order, takerAddress, '0')
            if (!r.info.nonceCheck) {
                throw Error('fillOrder failed, the ERC1155SellOrder has filled.')
            }
            if (!r.info.expireTimeCheck) {
                throw Error('fillOrder failed, the ERC1155SellOrder has expired.')
            }
            
            if (params.quantity) {
                quantity = params.quantity
                if (BigNumber.from(quantity).gt(r.info.erc1155Balance)) {
                    throw Error(`fillOrder failed, require quantity <= erc1155Balance(${r.info.erc1155Balance.toString()}).`)
                }
                if (BigNumber.from(quantity).gt(r.info.erc1155RemainingAmount)) {
                    throw Error(`fillOrder failed, require quantity <= erc1155RemainingAmount(${r.info.erc1155RemainingAmount.toString()}).`)
                }
            } else {
                if (r.info.erc1155RemainingAmount.lt(r.info.erc1155Balance)) {
                    quantity = r.info.erc1155RemainingAmount.toString()
                } else {
                    quantity = r.info.erc1155Balance.toString()
                }
            }
            if (BigNumber.from(quantity).lt('1')) {
                throw Error('fillOrder failed, fill 1155 order must set quantity.')
            }
            
            let amount = BigNumber.from(order.erc20TokenAmount).mul(quantity).div(order.erc1155TokenAmount)
            for (let i = 0; i < order.fees.length; i++) {
                const fee = BigNumber.from(order.fees[i].amount).mul(quantity).div(order.erc1155TokenAmount)
                amount = amount.add(fee)
            }
            
            if (amount.lt(r.takerCheckInfo.erc20Balance)) {
                throw Error(`fillOrder, erc20BalanceCheck failed, make sure account(${takerAddress}) have enough
                            balance(${ethers.utils.formatEther(amount.toString())}) of erc20Token(${order.erc20Token}).`
                )
            }
            
            if (amount.lt(r.takerCheckInfo.erc20Allowance) && order.erc20Token.toLowerCase() != ETH_TOKEN_ADDRESS) {
                const tx = await this.web3Signer.approveERC20Proxy(takerAddress, order.erc20Token, this.elementEx.address, gasParams)
                await tx.wait()
            }
            
            if (order.erc20Token.toLowerCase() != ETH_TOKEN_ADDRESS) {
                payValue = amount.toString()
            }
        }
        return { tokenId: assetId, payValue: payValue, quantity: quantity }
    }
}

function calcFees(params: CreateOrderParams): Fee[] {
    const fees: Fee[] = []
    const totalAmount = BigNumber.from(params.startTokenAmount)
    if (params.platformFeePoint && params.platformFeeAddress) {
        fees.push({
            recipient: params.platformFeeAddress,
            amount: totalAmount.mul(params.platformFeePoint).div(10000).toString(),
            feeData: '0x'
        })
    }
    if (params.royaltyFeePoint && params.royaltyFeeAddress) {
        fees.push({
            recipient: params.royaltyFeeAddress,
            amount: totalAmount.mul(params.royaltyFeePoint).div(10000).toString(),
            feeData: '0x'
        })
    }
    return fees
}

function calcERC20TokenAmount(params: CreateOrderParams, fees: Fee[]): string {
    let amount = BigNumber.from(params.startTokenAmount)
    for (const fee of fees) {
        amount = amount.sub(fee.amount)
    }
    return amount.toString()
}

function getOrderExpiry(params: CreateOrderParams): string {
    if (params.saleKind == null || params.saleKind == SaleKind.FixedPrice) {
        const { listingTime, expirationTime } = getOrderTimeOfFixedPrice(params)
        // unused(192bit) + listingTime(32bit) + expiryTime(32bit)
        return encodeBits([
            [0, 192],
            [listingTime, 32],
            [expirationTime, 32]
        ])
    }
    throw Error('createOrder failed, unsupported saleKind : ' + params.saleKind)
}

function getOrderTimeOfFixedPrice(params: CreateOrderParams) {
    const now = Math.floor(Date.now() / 1000)
    
    let listingTime
    if (params.listingTime) {
        listingTime = params.listingTime
        if (listingTime > now + MAX_LISTING_TIME) {
            throw Error('makeOrder failed, require listingTime <= now + 1 year.')
        }
        if (listingTime < (now - 3600)) {
            throw Error('makeOrder failed, listingTime >= now - 1 hour.')
        }
    } else {
        listingTime = now - 60
    }
    
    let expirationTime
    if (params.expirationTime != null) {
        expirationTime = params.expirationTime
        if (expirationTime < Math.max(listingTime, now)) {
            throw Error('makeOrder failed, require expirationTime >= Math.max(listingTime, now).')
        }
        if (expirationTime > Math.max(listingTime, now) + MAX_EXPIRATION_TIME) {
            throw Error('makeOrder failed, require expirationTime <= Math.max(listingTime, now) + 1 year.')
        }
    } else {
        expirationTime = Math.max(listingTime, now) + DEFAULT_EXPIRATION_TIME
    }
    return { listingTime, expirationTime }
}

function getBuyOrderTokenIdAndProperties(params: CreateOrderParams) {
    if (params.asset.id == null) {
        return {
            tokenId: '0',
            properties: [{
                propertyValidator: NULL_ADDRESS,
                propertyData: '0x'
            }]
        }
    } else {
        return {
            tokenId: BigNumber.from(params.asset.id).toString(),
            properties: []
        }
    }
}
