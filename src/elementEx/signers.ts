import { ContractABI } from '../contracts/abi';
import { Interface } from 'ethers/lib/utils';
import { ethers, providers, Signer} from "ethers";
import { TransactionRequest, TransactionResponse } from '@ethersproject/abstract-provider';
import { TypedDataDomain, TypedDataField } from "@ethersproject/abstract-signer";
import { TypedDataSigner } from '@ethersproject/abstract-signer/src.ts/index';

export type SignerOrProvider = Signer | ethers.providers.Web3Provider;

export interface IGasParams {
    gasPrice?: string | number;
    maxFeePerGas?: string | number;
    maxPriorityFeePerGas?: string | number;
}

export interface LimitedCallSpec extends IGasParams {
    from: string;
    to: string;
    data: string;
    value?: string;
}

const RPC_READ_PROVIDERS: { [key: number]: string } = {
    1: 'https://api.element.market/api/v1/jsonrpc',
    4: 'https://api-test.element.market/api/v1/jsonrpc',
    56: 'https://api.element.market/api/bsc/jsonrpc',
    97: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
    137: 'https://api.element.market/api/polygon/jsonrpc',
    80001: 'https://matic-mumbai.chainstacklabs.com',
    43114: "https://api.element.market/api/avalanche/jsonrpc",
    43113: "https://api-test.element.market/api/avalanche/jsonrpc"
};
const ERC20_INTERFACE = new Interface(ContractABI.erc20.abi);
const ERC721_INTERFACE = new Interface(ContractABI.erc721.abi);
const ERC1155_INTERFACE = new Interface(ContractABI.erc721.abi);

export class Signers {

    public chainId: number;
    public readProvider: providers.JsonRpcProvider;
    public signer: SignerOrProvider;

    constructor(signer: SignerOrProvider, chainId: number) {
        if (!RPC_READ_PROVIDERS[chainId]) {
            throw Error("Unsupported chainId : " + chainId);
        }
        if (signer instanceof Signer) {
            if (!signer.provider) {
                throw Error("signer.provider is unset");
            }
        }
        this.signer = signer;
        this.chainId = chainId;
        this.readProvider = new ethers.providers.JsonRpcProvider(RPC_READ_PROVIDERS[chainId]);
    }

    public async signMessage(accountAddress: string, message: string): Promise<string> {
        const signer = await this.getSigner(accountAddress);
        return await signer.signMessage(message);
    }

    public async signTypedData(accountAddress: string, domain: TypedDataDomain, types: Record<string, Array<TypedDataField>>, value: Record<string, any>): Promise<string> {
        const signer = await this.getSigner(accountAddress);
        const typedDataSigner : TypedDataSigner = signer as any as TypedDataSigner;
        if (typedDataSigner._signTypedData) {
            return await typedDataSigner._signTypedData(domain, types, value);
        } else {
            throw Error("Unsupported signTypedData");
        }
    }

    public async ethSend(call: LimitedCallSpec): Promise<TransactionResponse> {
        const transactionObject = {
            from: call.from,
            to: call.to,
            data: call.data,
        } as TransactionRequest;

        if (call.value && ethers.BigNumber.from(call.value).gt(0)) {
            transactionObject.value = ethers.BigNumber.from(call.value);
        }

        const signer = await this.getSigner(call.from);
        if (call.maxFeePerGas && call.maxPriorityFeePerGas) {
            transactionObject.maxFeePerGas = ethers.BigNumber.from(call.maxFeePerGas);
            transactionObject.maxPriorityFeePerGas = ethers.BigNumber.from(call.maxPriorityFeePerGas);
        } else if (call.gasPrice) {
            transactionObject.gasPrice = ethers.BigNumber.from(call.gasPrice);
        } else {
            if (!(signer.provider instanceof ethers.providers.Web3Provider)) {
                const gasPrice = await this.readProvider.getGasPrice();
                if (gasPrice) {
                    transactionObject.gasPrice = gasPrice;
                } else {
                    throw Error("Provider.getGasPrice failed!");
                }
            }
        }
        return await signer.sendTransaction(transactionObject);
    }

    public async getSigner(accountAddress: string) : Promise<Signer> {
        let signer;
        if (this.signer instanceof ethers.providers.Web3Provider) {
            const accounts = await this.signer.send("eth_requestAccounts", []);
            const find = accounts.find(item => item.toString().toLowerCase() === accountAddress.toLowerCase());
            if (!find) {
                throw Error(`address mismatch, accountAddress:${accountAddress.toLowerCase()}, but web3 connected account:${accounts}`);
            }
            signer = this.signer.getSigner(accountAddress);
        } else {
            signer = this.signer;
            const signerAddress = await signer.getAddress();
            if (accountAddress.toLowerCase() !== signerAddress.toLowerCase()) {
                throw Error(`address mismatch, accountAddress: ${accountAddress.toLowerCase()}, but signerAddress: ${signerAddress.toLowerCase()}`);
            }
        }

        const chainId = await signer.getChainId();
        if (chainId != this.chainId) {
            throw Error(`chainId mismatch, chainId: ${chainId}, but expected chainId: ${this.chainId}`);
        }
        return signer;
    }

    public async getCurrentAccount() : Promise<string> {
        let signer;
        if (this.signer instanceof ethers.providers.Web3Provider) {
            const accounts = await this.signer.send("eth_requestAccounts", []);
            if (accounts && accounts.length > 0) {
                return accounts[0];
            }
            throw Error('getCurrentAccount failed, please connect web3, and choose a account.');
        } else {
            signer = this.signer;
            return await signer.getAddress();
        }
    }

    public async approveERC20Proxy(fromAddress: string, erc20Address: string, approvedAddress: string, gasParams: IGasParams, allowance?: string): Promise<TransactionResponse> {
        const quantity = allowance || ethers.constants.MaxInt256.toString();
        const call = this.getCallData({
            from: fromAddress,
            to: erc20Address,
            iface: ERC20_INTERFACE,
            methodsName: 'approve',
            params: [approvedAddress, quantity]
        });
        if (gasParams) {
            call.gasPrice = gasParams.gasPrice;
            call.maxFeePerGas = gasParams.maxFeePerGas;
            call.maxPriorityFeePerGas = gasParams.maxPriorityFeePerGas;
        }
        return this.ethSend(call);
    }

    public async approveERC721Proxy(fromAddress: string, erc721Address: string, approvedAddress: string, gasParams: IGasParams, approved = true): Promise<TransactionResponse> {
        const call = this.getCallData({
            from: fromAddress,
            to: erc721Address,
            iface: ERC721_INTERFACE,
            methodsName: 'setApprovalForAll',
            params: [approvedAddress, approved]
        });
        if (gasParams) {
            call.gasPrice = gasParams.gasPrice;
            call.maxFeePerGas = gasParams.maxFeePerGas;
            call.maxPriorityFeePerGas = gasParams.maxPriorityFeePerGas;
        }
        return this.ethSend(call);
    }

    public async approveERC1155Proxy(fromAddress: string, erc1155Address: string, approvedAddress: string, gasParams: IGasParams, approved = true): Promise<TransactionResponse> {
        const call = this.getCallData({
            from: fromAddress,
            to: erc1155Address,
            iface: ERC1155_INTERFACE,
            methodsName: 'setApprovalForAll',
            params: [approvedAddress, approved]
        });
        if (gasParams) {
            call.gasPrice = gasParams.gasPrice;
            call.maxFeePerGas = gasParams.maxFeePerGas;
            call.maxPriorityFeePerGas = gasParams.maxPriorityFeePerGas;
        }
        return this.ethSend(call);
    }

    getCallData<T>({ from, to, value, iface, methodsName, params}
            : { from: string, to: string, value?: string, iface: Interface, methodsName: string, params?: Array<T> }
    ): LimitedCallSpec {
        const func = iface.getFunction(methodsName);
        if (func.type !== 'function') {
            throw Error('abi error');
        }
        const data = params ? iface.encodeFunctionData(func, params) : iface.getSighash(func);
        if (func.payable && value) {
            return { from, to, data, value };
        } else {
            return { from, to, data };
        }
    }
}
