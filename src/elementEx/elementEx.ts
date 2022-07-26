import { Contract, ethers } from 'ethers'
import { Signers } from './signers'
import { AssetSchema, SaleKind, Signature, SignatureType } from '../types/elementTypes'
import { IFillOrderParams, IMakeOrderParams } from '../types/agentTypes'
import { BigNumber, EIP712TypedData, ETH_TOKEN_ADDRESS, NULL_ADDRESS } from '@txdev/0x-utils'
import { bufferToHex, fromRpcSig } from 'ethereumjs-util'
import { decodeExpiry, encodeExpiry } from './expiryUtil'
import { NFTOrderInfo, toStandardNFTOrder } from './orderConverter'
import { ContractABI, ElementEx_V3_CONTRACTS_ADDRESSES } from '../contracts/config'
import { ERC1155Order, ERC721Order, Fee, getOrderHash, getOrderTypedData } from './EIP712Orders'
import { TransactionReceipt } from '@ethersproject/abstract-provider'

BigNumber.config({ EXPONENTIAL_AT: 1024});

export const DEFAULT_EXPIRATION_TIME = (7 * 86400);
export const MAX_EXPIRATION_TIME = (365 * 86400);
export const MAX_LISTING_TIME = (365 * 86400);

export class ElementEx {

    public elementExV3: Contract;
    public elementExV3Helper: Contract;
    public feeRecipient: string;
    public exchangeKeeper: string;
    public signers: Signers;
    public WToken: string;

    constructor(signers: Signers) {
        this.signers = signers;
        const contracts = ElementEx_V3_CONTRACTS_ADDRESSES[signers.chainId];
        this.WToken = contracts.WToken;
        this.feeRecipient = contracts.FeeRecipient;
        this.exchangeKeeper = contracts.ElementExchangeKeeper;
        this.elementExV3 = new ethers.Contract(contracts.ElementEx, ContractABI.elementExV3.abi, signers.readProvider);
        this.elementExV3Helper = new ethers.Contract(contracts.ElementExHelper, ContractABI.elementExV3Helper.abi, signers.readProvider);
    }

    public async makeSellOrder(params: IMakeOrderParams): Promise<NFTOrderInfo> {
        const expiry = getSellOrderExpiry(params);
        const fees = this.calcFees(params);
        const erc20Token = (params.paymentToken != NULL_ADDRESS) ? params.paymentToken : ETH_TOKEN_ADDRESS;
        const erc20TokenAmount = calcERC20TokenAmount(params, fees);

        const order: any = {
            maker: params.makerAddress,
            taker: params.takerAddress,
            expiry: expiry,
            nonce: params.nonce,
            erc20Token: erc20Token,
            erc20TokenAmount: erc20TokenAmount,
            fees: fees,
        };

        if (params.asset.id == undefined) {
            throw Error('makeSellOrder failed, asset.id unset');
        }
        switch (params.asset.schema) {
            case AssetSchema.ERC721:
                order.nft = params.asset.address;
                order.nftId = params.asset.id;
                break
            case AssetSchema.ERC1155:
                order.erc1155Token = params.asset.address;
                order.erc1155TokenId = params.asset.id;
                order.erc1155TokenAmount = params.quantity;
                break
            default:
                throw Error('makeSellOrder failed, unsupported schema : ' + params.asset.schema);
        }

        await this.checkAndApproveSellOrder(order);

        const chainId = this.signers.chainId;
        const sellOrder = toStandardNFTOrder(order);
        const typedData = getOrderTypedData(sellOrder, chainId);
        const signature = await this.signOrder(typedData);
        await this.validateSignature(sellOrder, signature);

        return {
            chainId: chainId,
            order: sellOrder,
            sig: signature,
            orderHash: getOrderHash(sellOrder, chainId)
        }
    }

    public async makeBuyOrder(params: IMakeOrderParams): Promise<NFTOrderInfo> {
        const expiry = getBuyOrderExpiry(params);
        const fees = this.calcFees(params);
        const erc20TokenAmount = calcERC20TokenAmount(params, fees);

        const order: any = {
            maker: params.makerAddress,
            taker: params.takerAddress,
            expiry: expiry,
            nonce: params.nonce,
            erc20Token: params.paymentToken,
            erc20TokenAmount: erc20TokenAmount,
            fees: fees,
        };

        const { tokenId, properties } = getBuyOrderTokenIdAndProperties(params);
        switch (params.asset.schema) {
            case AssetSchema.ERC721:
                order.nft = params.asset.address;
                order.nftId = tokenId;
                order.nftProperties = properties;
                break
            case AssetSchema.ERC1155:
                order.erc1155Token = params.asset.address;
                order.erc1155TokenId = params.asset.id;
                order.erc1155TokenAmount = params.quantity;
                order.erc1155TokenProperties = properties;
                break
            default:
                throw Error('makeBuyOrder failed, unsupported schema : ' + params.asset.schema);
        }

        await this.checkAndApproveBuyOrder(order);

        const chainId = this.signers.chainId;
        const buyOrder = toStandardNFTOrder(order);
        const typedData = getOrderTypedData(buyOrder, chainId);
        const signature = await this.signOrder(typedData);
        await this.validateSignature(buyOrder, signature);
        return {
            chainId: chainId,
            order: buyOrder,
            sig: signature,
            orderHash: getOrderHash(buyOrder, chainId)
        }
    }

    public async fillOrder(params: IFillOrderParams): Promise<TransactionReceipt> {
        const { order, sig, takerAddress } = params;
        await this.validateSignature(order, sig);

        let calldata, value;
        if (order['nft'] != undefined) {
            // ERC721Order
            const { tokenId, payValue } = await this.fillERC721OrderCheckAndApprove(params);
            if (order['nftProperties'] != undefined) {
                // sellERC721
                const unwrapNativeToken = order.erc20Token.toLowerCase() == this.WToken.toLowerCase();
                calldata = await this.elementExV3.populateTransaction.sellERC721(order, sig, tokenId, unwrapNativeToken, "0x");
            } else {
                // buyERC721
                const info = decodeExpiry(order.expiry);
                if (info.saleKind == SaleKind.DutchAuction) {
                    calldata = await this.elementExV3.populateTransaction.buyERC721Ex(order, sig, NULL_ADDRESS, "0x");
                } else if (info.saleKind == SaleKind.EnglishAuction) {
                    throw Error("fillOrder failed, englishAuction order should be filled by element.market")
                } else {
                    calldata = await this.elementExV3.populateTransaction.buyERC721(order, sig);
                }
                value = payValue;
            }
        } else if (order['erc1155Token'] != undefined) {
            // ERC1155Order
            const { tokenId, payValue } = await this.fillERC1155OrderCheckAndApprove(params);
            if (order['erc1155TokenProperties'] != undefined) {
                // sellERC1155
                const unwrapNativeToken = order.erc20Token.toLowerCase() == this.WToken.toLowerCase();
                calldata = await this.elementExV3.populateTransaction.sellERC1155(order, sig, tokenId, params.quantity, unwrapNativeToken, "0x");
            } else {
                // buyERC1155
                const info = decodeExpiry(order.expiry);
                if (info.saleKind == SaleKind.DutchAuction) {
                    calldata = await this.elementExV3.populateTransaction.buyERC1155Ex(order, sig, NULL_ADDRESS, params.quantity, "0x");
                } else if (info.saleKind == SaleKind.EnglishAuction) {
                    throw Error("fillOrder failed, englishAuction order should be filled by element.market")
                } else {
                    calldata = await this.elementExV3.populateTransaction.buyERC1155(order, sig, params.quantity);
                }
                value = payValue;
            }
        } else {
            throw Error('fillOrder failed, unsupported order.');
        }

        if (!calldata || !calldata.data) {
            throw Error('fillOrder, populateTransaction failed.');
        }
        const tx = await this.signers.ethSend({
            from: takerAddress,
            to: this.elementExV3.address,
            data: calldata.data,
            value: value
        });
        return await tx.wait(2);
    }

    public async cancelOrder(order: ERC721Order | ERC1155Order): Promise<TransactionReceipt>  {
        let calldata;
        if (order['nft'] != undefined) {
            const isCancelled = await this.elementExV3Helper.isERC721OrderNonceFilled(order.maker, order.nonce);
            if (isCancelled) {
                throw Error('cancelOrder failed, order has been cancelled.');
            }
            calldata = await this.elementExV3.populateTransaction.cancelERC721Order(order.nonce);
        } else if (order['erc1155Token'] != undefined) {
            const isCancelled = await this.elementExV3Helper.isERC1155OrderNonceCancelled(order.maker, order.nonce);
            if (isCancelled) {
                throw Error('cancelOrder failed, order has been cancelled.');
            }
            calldata = await this.elementExV3.populateTransaction.cancelERC1155Order(order.nonce);
        } else {
            throw Error('cancelOrder failed, unsupported order.');
        }

        if (!calldata || !calldata.data) {
            throw Error('cancelOrder, populateTransaction failed.');
        }
        const tx = await this.signers.ethSend({
            from: order.maker,
            to: this.elementExV3.address,
            data: calldata.data
        });
        return await tx.wait(2);
    }

    public async cancelAllOrders(accountAddress: string): Promise<TransactionReceipt>  {
        const calldata = await this.elementExV3.populateTransaction.incrementHashNonce();
        if (!calldata || !calldata.data) {
            throw Error('cancelAllOrders, populateTransaction failed.');
        }
        const tx = await this.signers.ethSend({
            from: accountAddress,
            to: this.elementExV3.address,
            data: calldata.data
        });
        return await tx.wait(2);
    }

    private async signOrder(typedData : EIP712TypedData): Promise<Signature> {
        const maker = typedData.message.maker as string;
        const typeSignStr = await this.signers.signTypedData(maker, typedData.domain, typedData.types, typedData.message);
        const signer = ethers.utils.verifyTypedData(typedData.domain, typedData.types, typedData.message, typeSignStr);
        if (maker.toLowerCase() !== signer.toLowerCase()) {
            throw Error(`verify EIP712TypedData failed, order.maker : ${maker}, signer = ${signer}`);
        }

        const sig = fromRpcSig(typeSignStr);
        return {
            signatureType: SignatureType.EIP712,
            v: sig.v,
            r: bufferToHex(sig.r),
            s: bufferToHex(sig.s),
        };
    }

    private async validateSignature(order: ERC721Order | ERC1155Order, signature: Signature) {
        if (order['nft'] != undefined) {
            if (order['nftProperties'] != undefined) {
                await this.elementExV3.validateERC721BuyOrderSignature(order, signature).catch(e => {
                    throw Error('ERC721 validateERC721BuyOrderSignature failed.');
                });
            } else {
                await this.elementExV3.validateERC721SellOrderSignature(order, signature).catch(e => {
                    throw Error('ERC721 validateERC721SellOrderSignature failed.');
                });
            }
        } else if (order['erc1155Token'] != undefined) {
            if (order['erc1155TokenProperties'] != undefined) {
                await this.elementExV3.validateERC1155BuyOrderSignature(order, signature).catch(e => {
                    throw Error('ERC1155 validateERC1155BuyOrderSignature failed.');
                });
            } else {
                await this.elementExV3.validateERC1155SellOrderSignature(order, signature).catch(e => {
                    throw Error('ERC1155 validateERC1155SellOrderSignature failed.');
                });
            }
        } else {
            throw Error("validateSignature, unsupported order");
        }
    }

    private async checkAndApproveSellOrder(order: ERC721Order | ERC1155Order) {
        const isERC721Order = order['nft'] != undefined;
        const r = isERC721Order
            ? await this.elementExV3Helper.checkERC721SellOrder(order, NULL_ADDRESS)
            : await this.elementExV3Helper.checkERC1155SellOrder(order, NULL_ADDRESS, "0");

        order.hashNonce = r.info.hashNonce.toString();
        if (r.info.success) {
            return;
        }
        if (!r.info.makerCheck) {
             throw Error("makeSellOrder failed, makerCheck failed.");
        }
        if (!r.info.takerCheck) {
             throw Error("makeSellOrder failed, takerCheck failed.");
        }
        if (!r.info.listingTimeCheck) {
             throw Error("makeSellOrder failed, listingTimeCheck failed.");
        }
        if (!r.info.expireTimeCheck) {
             throw Error("makeSellOrder failed, expireTimeCheck failed.");
        }
        if (!r.info.extraCheck) {
             throw Error("makeSellOrder failed, extraCheck failed.");
        }
        if (!r.info.feesCheck) {
             throw Error("makeSellOrder failed, feesCheck failed.");
        }
        if (!r.info.nonceCheck) {
             throw Error("makeSellOrder failed, nonceCheck failed, please try again.");
        }
        if (!r.info.erc20AddressCheck) {
             throw Error("makeSellOrder failed, erc20AddressCheck failed.");
        }
        if (isERC721Order) {
            if (!r.info.erc721OwnerCheck) {
                throw Error(`makeSellOrder, erc721OwnerCheck failed, make sure account(${order.maker}) is owner of assetId(${order['nftId']}).`);
            }
            if (!r.info.erc721ApprovedCheck) {
                const tx = await this.signers.approveERC721Proxy(order.maker, order['nft'], this.elementExV3.address);
                await tx.wait(2);

                // recheck approved
                const erc721 = new ethers.Contract(order['nft'], ContractABI.erc721.abi, this.signers.readProvider);
                const isApproved = await erc721.isApprovedForAll(order.maker, this.elementExV3.address);
                if (!isApproved) {
                    throw Error("makeSellOrder, ERC721: maker approve to elementEx failed.");
                }
            }
        } else {
            if (order['erc1155TokenAmount'] == undefined || new BigNumber(order['erc1155TokenAmount']).lt("1")) {
                 throw Error("makeSellOrder, quantityCheck failed, erc1155 should set quantity.");
            }
            if (!r.info.remainingAmountCheck) {
                 throw Error("makeSellOrder, remainingAmountCheck failed, please try again.");
            }
            if (!r.info.erc1155BalanceCheck) {
                 throw Error(`makeSellOrder, erc1155BalanceCheck failed, account(${order.maker}), require erc1155Balance >= quantity`);
            }
            if (!r.info.erc1155ApprovedCheck) {
                const tx = await this.signers.approveERC1155Proxy(order.maker, order['erc1155Token'], this.elementExV3.address);
                await tx.wait(2);

                // recheck approved
                const erc1155 = new ethers.Contract(order['erc1155Token'], ContractABI.erc1155.abi, this.signers.readProvider);
                const isApproved = await erc1155.isApprovedForAll(order.maker, this.elementExV3.address);
                if (!isApproved) {
                    throw Error("makeSellOrder, ERC1155: maker approve to elementEx failed.");
                }
            }
        }
    }

    private async checkAndApproveBuyOrder(order: ERC721Order | ERC1155Order) {
        const isERC721Order = order['nft'] != undefined;
        const r = isERC721Order
          ? await this.elementExV3Helper.checkERC721BuyOrder(order, NULL_ADDRESS, "0")
          : await this.elementExV3Helper.checkERC1155BuyOrder(order, NULL_ADDRESS, "0", "0");

        order.hashNonce = r.info.hashNonce.toString();
        if (r.info.success) {
            return;
        }
        if (!r.info.makerCheck) {
            throw Error("makeBuyOrder, makerCheck failed.");
        }
        if (!r.info.takerCheck) {
            throw Error("makeBuyOrder, takerCheck failed.");
        }
        if (!r.info.listingTimeCheck) {
            throw Error("makeBuyOrder, listingTimeCheck failed.");
        }
        if (!r.info.expireTimeCheck) {
            throw Error("makeBuyOrder, expireTimeCheck failed.");
        }
        if (!r.info.feesCheck) {
            throw Error("makeBuyOrder, feesCheck failed.");
        }
        if (!r.info.nonceCheck) {
            throw Error("makeBuyOrder, nonceCheck failed, please try again.");
        }
        if (!r.info.erc20AddressCheck) {
            throw Error("makeBuyOrder, erc20AddressCheck failed, should be ERC20 address, can not be native address.");
        }
        if (!r.info.propertiesCheck) {
            throw Error("makeBuyOrder, propertiesCheck failed.");
        }
        if (isERC721Order) {
            if (!r.info.erc721AddressCheck) {
                throw Error("makeBuyOrder, erc721AddressCheck failed, maybe is not a ERC721 contract.");
            }
        } else {
            if (!r.info.erc1155AddressCheck) {
                throw Error("makeBuyOrder, erc1155AddressCheck failed, maybe is not a ERC1155 contract.");
            }
            if (order['erc1155TokenAmount'] == undefined || new BigNumber(order['erc1155TokenAmount']).lt("1")) {
                throw Error("makeBuyOrder, quantityCheck failed, quantity: " + order['erc1155TokenAmount']);
            }
            if (!r.info.remainingAmountCheck) {
                throw Error("makeBuyOrder, remainingAmountCheck failed, please try again.");
            }
        }
        if (!r.info.erc20BalanceCheck) {
            throw Error(`makeBuyOrder, erc20BalanceCheck failed, make sure account${order.maker} have enough balance of erc20Token(${order.erc20Token}).`);
        }
        if (!r.info.erc20AllowanceCheck && order.erc20Token != NULL_ADDRESS && order.erc20Token.toLowerCase() != ETH_TOKEN_ADDRESS) {
            const tx = await this.signers.approveERC20Proxy(order.maker, order.erc20Token, this.elementExV3.address);
            await tx.wait(2);

            // recheck approved
            const erc20 = new ethers.Contract(order.erc20Token, ContractABI.erc20.abi, this.signers.readProvider);
            const allowance = await erc20.allowance(order.maker, this.elementExV3.address);
            if (allowance.lt(r.info.erc20TotalAmount)) {
                throw Error("makeBuyOrder, ERC20: maker approve to elementEx failed.");
            }
        }
    }

    private async fillERC721OrderCheckAndApprove(params: IFillOrderParams) {
        const order = params.order as ERC721Order;
        const takerAddress = params.takerAddress;
        let assetId = params.assetId;
        let payValue;

        if (order.nftProperties != undefined) {
            if (!assetId) {
                if (order.nftProperties.length > 0) {
                    throw Error('fillOrder failed, fill the collectionOfferOrder must set assetId.');
                }
                assetId = order.nftId;
            }

            const r = await this.elementExV3Helper.checkERC721BuyOrder(order, takerAddress, assetId);
            if (!r.info.nonceCheck) {
                throw Error('fillOrder failed, the ERC721BuyOrder has filled.');
            }
            if (!r.info.expireTimeCheck) {
                throw Error('fillOrder failed, the ERC721BuyOrder has expired.');
            }
            if (!r.takerCheckInfo.listingTimeCheck) {
                throw Error('fillOrder failed, the ERC721BuyOrder has not yet reached the transaction time.');
            }
            if (!r.takerCheckInfo.ecr721TokenIdCheck) {
                throw Error('fillOrder failed, assetId mismatch the ERC721BuyOrder.nftId.');
            }
            if (!r.takerCheckInfo.takerCheck) {
                throw Error('fillOrder failed, taker mismatch the ERC721BuyOrder.taker');
            }
            if (!r.takerCheckInfo.erc721OwnerCheck) {
                throw Error(`fillOrder, erc721OwnerCheck failed, make sure account(${takerAddress}) is owner of assetId(${assetId}).`);
            }
            if (!r.takerCheckInfo.erc721ApprovedCheck) {
                const tx = await this.signers.approveERC721Proxy(takerAddress, order.nft, this.elementExV3.address);
                await tx.wait(2);

                // recheck approved
                const erc721 = new ethers.Contract(order.nft, ContractABI.erc721.abi, this.signers.readProvider);
                const isApproved = await erc721.isApprovedForAll(takerAddress, this.elementExV3.address);
                if (!isApproved) {
                    throw Error("fillOrder, ERC721: taker approve to elementEx failed.");
                }
            }
        } else {
            if (assetId && assetId != order.nftId) {
                throw Error('fillOrder failed, assetId mismatch the ERC721SellOrder.nftId.');
            }
            assetId = order.nftId;

            const r = await this.elementExV3Helper.checkERC721SellOrder(order, takerAddress);
            if (!r.info.nonceCheck) {
                throw Error('fillOrder failed, the ERC721SellOrder has filled.');
            }
            if (!r.info.expireTimeCheck) {
                throw Error('fillOrder failed, the ERC721SellOrder has expired.');
            }
            if (!r.takerCheckInfo.listingTimeCheck) {
                throw Error('fillOrder failed, the ERC721SellOrder has not yet reached the transaction time.');
            }
            if (!r.takerCheckInfo.takerCheck) {
                throw Error('fillOrder failed, taker mismatch the ERC721SellOrder.taker');
            }
            if (!r.takerCheckInfo.balanceCheck) {
                const { saleKind } = decodeExpiry(order.expiry);
                if (saleKind != SaleKind.DutchAuction) {
                    throw Error(`fillOrder, erc20BalanceCheck failed, make sure account${takerAddress} have enough balance of erc20Token(${order.erc20Token}).`);
                }
            }
            if (!r.takerCheckInfo.allowanceCheck && order.erc20Token != NULL_ADDRESS && order.erc20Token.toLowerCase() != ETH_TOKEN_ADDRESS) {
                const tx = await this.signers.approveERC20Proxy(takerAddress, order.erc20Token, this.elementExV3.address);
                await tx.wait(2);

                // recheck approved
                const erc20 = new ethers.Contract(order.erc20Token, ContractABI.erc20.abi, this.signers.readProvider);
                const allowance = await erc20.allowance(takerAddress, this.elementExV3.address);
                if (allowance.lt(r.info.erc20TotalAmount)) {
                    throw Error("fillOrder, ERC20: taker approve to elementEx failed.");
                }
            }
            payValue = r.info.erc20TotalAmount.toString();
        }
        return { tokenId: assetId, payValue };
    }

    private async fillERC1155OrderCheckAndApprove(params: IFillOrderParams) {
        const order = params.order as ERC1155Order;
        const takerAddress = params.takerAddress;
        let assetId = params.assetId;
        let payValue;

        if (params.quantity == undefined || new BigNumber(params.quantity).lt("1")) {
            throw Error("fillOrder failed, fill 1155 order must set quantity.");
        }
        const quantity = params.quantity;

        // fill ERC1155BuyOrder
        if (order.erc1155TokenProperties != undefined) {
            if (!assetId) {
                if (order.erc1155TokenProperties.length > 0) {
                    throw Error('fillOrder failed, fill the collectionOfferOrder should set assetId.');
                }
                assetId = order.erc1155TokenId;
            }

            const r = await this.elementExV3Helper.checkERC1155BuyOrder(order, takerAddress, assetId, quantity);
            if (!r.info.nonceCheck) {
                throw Error('fillOrder failed, the ERC1155BuyOrder has filled.');
            }
            if (!r.info.expireTimeCheck) {
                throw Error('fillOrder failed, the ERC1155BuyOrder has expired.');
            }
            if (!r.takerCheckInfo.listingTimeCheck) {
                throw Error('fillOrder failed, the ERC1155BuyOrder has not yet reached the transaction time.');
            }
            if (!r.takerCheckInfo.ecr1155TokenIdCheck) {
                throw Error('fillOrder failed, assetId mismatch the ERC1155BuyOrder.erc1155TokenId');
            }
            if (!r.takerCheckInfo.takerCheck) {
                throw Error('fillOrder failed, taker mismatch the ERC1155BuyOrder.taker');
            }
            if (!r.takerCheckInfo.erc1155BalanceCheck) {
                throw Error(`fillOrder, taker erc1155BalanceCheck failed, account(${takerAddress}), require erc1155SellAmount <= erc1155Balance.`);
            }
            if (!r.takerCheckInfo.sellAmountCheck) {
                throw Error(`fillOrder, taker sellAmountCheck failed, require erc1155SellAmount <= erc1155RemainingAmount(${r.info.erc1155RemainingAmount.toString()}).`);
            }
            if (!r.takerCheckInfo.erc1155ApprovedCheck) {
                const tx = await this.signers.approveERC1155Proxy(takerAddress, order.erc1155Token, this.elementExV3.address);
                await tx.wait(2);

                // recheck approved
                const erc1155 = new ethers.Contract(order.erc1155Token, ContractABI.erc1155.abi, this.signers.readProvider);
                const isApproved = await erc1155.isApprovedForAll(takerAddress, this.elementExV3.address);
                if (!isApproved) {
                    throw Error("fillOrder, ERC1155: taker approve to elementEx failed.");
                }
            }
        } else {
            // fill ERC1155SellOrder
            if (assetId && assetId != order.erc1155TokenId) {
                throw Error('fillOrder failed, assetId mismatch the ERC1155SellOrder.erc1155TokenId');
            }
            assetId = order.erc1155TokenId;

            const r = await this.elementExV3Helper.checkERC1155SellOrder(order, takerAddress, quantity);
            if (!r.info.nonceCheck) {
                throw Error('fillOrder failed, the ERC1155SellOrder has filled.');
            }
            if (!r.info.expireTimeCheck) {
                throw Error('fillOrder failed, the ERC1155SellOrder has expired.');
            }
            if (!r.takerCheckInfo.listingTimeCheck) {
                throw Error('fillOrder failed, the ERC1155SellOrder has not yet reached the transaction time.');
            }
            if (!r.takerCheckInfo.takerCheck) {
                throw Error('fillOrder failed, taker mismatch the ERC1155SellOrder.taker');
            }
            if (!r.takerCheckInfo.balanceCheck) {
                const { saleKind } = decodeExpiry(order.expiry);
                if (saleKind != SaleKind.DutchAuction) {
                    throw Error(`fillOrder, erc20BalanceCheck failed, make sure account${takerAddress} have enough 
                            balance(${r.takerCheckInfo.erc20WillPayAmount.toString()}) of erc20Token(${order.erc20Token}).`
                    );
                }
            }
            if (!r.takerCheckInfo.buyAmountCheck) {
                throw Error(`fillOrder, taker buyAmountCheck failed, require erc1155BuyAmount <= erc1155RemainingAmount(${r.info.erc1155RemainingAmount.toString()}).`);
            }
            if (!r.takerCheckInfo.allowanceCheck && order.erc20Token != NULL_ADDRESS && order.erc20Token.toLowerCase() != ETH_TOKEN_ADDRESS) {
                const tx = await this.signers.approveERC20Proxy(takerAddress, order.erc20Token, this.elementExV3.address);
                await tx.wait(2);

                // recheck approved
                const erc20 = new ethers.Contract(order.erc20Token, ContractABI.erc20.abi, this.signers.readProvider);
                const allowance = await erc20.allowance(takerAddress, this.elementExV3.address);
                if (allowance.lt(r.info.erc20TotalAmount)) {
                    throw Error("fillOrder, ERC20: taker approve to elementEx failed.");
                }
            }
            payValue = r.takerCheckInfo.erc20WillPayAmount.toString();
        }
        return { tokenId: assetId, payValue };
    }

    private calcFees(params: IMakeOrderParams): Fee[] {
        const fees: Fee[] = [];
        const totalAmount = new BigNumber(params.startTokenAmount);
        if (params.platformFeePoint > 0) {
            fees.push({
                recipient: this.feeRecipient,
                amount: totalAmount.times(params.platformFeePoint).div(10000).toFixed(0, BigNumber.ROUND_DOWN),
                feeData: "0x"
            });
        }
        if (params.royaltyFeePoint > 0 && params.royaltyFeeAddress) {
            fees.push({
                recipient: params.royaltyFeeAddress,
                amount: totalAmount.times(params.royaltyFeePoint).div(10000).toFixed(0, BigNumber.ROUND_DOWN),
                feeData: "0x"
            });
        }
        if (params["saleKind"] == SaleKind.EnglishAuction) {
            fees.push({
                recipient: this.exchangeKeeper,
                amount: "0",
                feeData: "0x"
            });
        }
        return fees;
    }
}

function calcERC20TokenAmount(params: IMakeOrderParams, fees: Fee[]): string {
    let amount = new BigNumber(params.startTokenAmount);
    for (const fee of fees) {
        amount = amount.minus(fee.amount);
    }
    return amount.toString(10);
}

function getSellOrderExpiry(params: IMakeOrderParams): string {
    if (params.saleKind == undefined || params.saleKind == SaleKind.FixedPrice) {
        const { listingTime, expirationTime } = getOrderTimeOfFixedPrice(params);
        return encodeExpiry(SaleKind.FixedPrice, 0, listingTime, expirationTime)
    }

    // 荷兰拍
    if (params.saleKind == SaleKind.DutchAuction) {
        const { listingTime, expirationTime } = getOrderTimeOfDutchAuction(params);
        if (!params.endTokenAmount || new BigNumber(params.endTokenAmount).gt(params.startTokenAmount)) {
            throw Error('makeSellOrder failed, dutchAuction require endTokenAmount <= startTokenAmount');
        }
        const extra = new BigNumber(params.startTokenAmount).minus(params.endTokenAmount).div(params.startTokenAmount).times(1e8).toFixed(0, BigNumber.ROUND_DOWN);
        return encodeExpiry(params.saleKind, extra, listingTime, expirationTime);
    }

    // 英拍
    if (params.saleKind == SaleKind.EnglishAuction) {
        const { listingTime, expirationTime } = getOrderTimeOfEnglishAuction(params);
        if (!params.endTokenAmount
          || new BigNumber(params.endTokenAmount).eq(0)
          || new BigNumber(params.endTokenAmount).lt(params.startTokenAmount)) {
            throw Error('makeSellOrder failed, englishAuction require endTokenAmount >= startTokenAmount');
        }
        const extra = new BigNumber(params.endTokenAmount).minus(params.startTokenAmount).div(params.endTokenAmount).times(1e8).toFixed(0, BigNumber.ROUND_UP);
        return encodeExpiry(params.saleKind, extra, listingTime, expirationTime);
    }

     throw Error("makeSellOrder failed, unsupported saleKind : " + params.saleKind);
}

function getBuyOrderExpiry(params: IMakeOrderParams): string {
    const { listingTime, expirationTime } = getOrderTimeOfFixedPrice(params);
    return encodeExpiry(SaleKind.FixedPrice, 0, listingTime, expirationTime)
}

function getOrderTimeOfFixedPrice(params: IMakeOrderParams) {
    const now = Math.round(Date.now() / 1000);

    let listingTime;
    if (params.listingTime != undefined) {
        listingTime = params.listingTime;
        if (listingTime > now + MAX_LISTING_TIME) {
            throw Error('makeOrder failed, fixedPrice require listingTime <= now + 1 year.');
        }
    } else {
        listingTime = 0;
    }

    let expirationTime;
    if (params.expirationTime != undefined) {
        expirationTime = params.expirationTime;
        if (expirationTime < Math.max(listingTime, now)) {
            throw Error('makeOrder failed, fixedPrice require expirationTime >= Math.max(listingTime, now).');
        }
        if (expirationTime > Math.max(listingTime, now) + MAX_EXPIRATION_TIME) {
            throw Error('makeOrder failed, fixedPrice require expirationTime <= Math.max(listingTime, now) + 1 year.');
        }
    } else {
        expirationTime = Math.max(listingTime, now) + DEFAULT_EXPIRATION_TIME;
    }
    return { listingTime, expirationTime };
}

function getOrderTimeOfDutchAuction(params: IMakeOrderParams) {
    const now = Math.round(Date.now() / 1000);

    let listingTime;
    if (params.listingTime != undefined) {
        listingTime = params.listingTime;
        if (listingTime > now + MAX_LISTING_TIME) {
            throw Error('makeSellOrder failed, dutchAuction require listingTime < now + 1 year.');
        }
        if (listingTime < now) {
            throw Error('makeSellOrder failed, dutchAuction require listingTime >= now.');
        }
    } else {
        listingTime = now;
    }

    let expirationTime;
    if (params.expirationTime != undefined) {
        expirationTime = params.expirationTime;
        if (expirationTime < listingTime) {
            throw Error('makeSellOrder failed, dutchAuction require expirationTime > listingTime.');
        }
        if (expirationTime > listingTime + MAX_EXPIRATION_TIME) {
            throw Error('makeSellOrder failed, dutchAuction require expirationTime <= listingTime + 1 year.');
        }
    } else {
        expirationTime = listingTime + DEFAULT_EXPIRATION_TIME;
    }
    return { listingTime, expirationTime };
}

function getOrderTimeOfEnglishAuction(params: IMakeOrderParams) {
    const now = Math.round(Date.now() / 1000);
    if (params.listingTime != undefined) {
        throw Error('makeSellOrder failed, englishAuction don\'t support set listingTime.')
    }

    let listingTime;
    if (params.expirationTime != undefined) {
        if (params.expirationTime < now) {
            throw Error('makeSellOrder failed, englishAuction require expirationTime >= now.');
        }
        if (params.expirationTime > now + MAX_EXPIRATION_TIME) {
            throw Error('makeSellOrder failed, englishAuction require expirationTime <= now + 1 year.');
        }
        listingTime = params.expirationTime;
    } else {
        listingTime = now + DEFAULT_EXPIRATION_TIME;
    }

    const expirationTime = listingTime + 2 * 86400;
    return { listingTime, expirationTime };
}


function getBuyOrderTokenIdAndProperties(params: IMakeOrderParams) {
    if (params.asset.id == undefined) {
        return {
            tokenId: "0",
            properties: [{
                propertyValidator: NULL_ADDRESS,
                propertyData: "0x",
            }]
        };
    } else {
        return {
            tokenId: params.asset.id,
            properties: []
        };
    }
}
