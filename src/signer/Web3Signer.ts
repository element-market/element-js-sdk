import { ethers, Signer } from 'ethers'
import { TransactionRequest, TransactionResponse } from '@ethersproject/abstract-provider'
import { ContractABI } from '../contracts/abi'
import { GasParams, NULL_ADDRESS, SignerOrProvider } from '../types/types'
import { _TypedDataEncoder } from 'ethers/lib/utils'
import { estimateGas } from '../util/gasUtil'

export interface LimitedCallSpec extends GasParams {
  from: string;
  to: string;
  data: string;
  value?: string;
}

const erc20Contract = new ethers.Contract(NULL_ADDRESS, ContractABI.erc20.abi)
const erc721Contract = new ethers.Contract(NULL_ADDRESS, ContractABI.erc721.abi)
const erc1155Contract = new ethers.Contract(NULL_ADDRESS, ContractABI.erc1155.abi)

export class Web3Signer {
  
  public chainId: number
  public signer: SignerOrProvider
  
  constructor(signer: SignerOrProvider, chainId: number) {
    if (signer instanceof Signer) {
      if (!signer.provider) {
        throw Error('signer.provider is unset')
      }
    }
    this.signer = signer
    this.chainId = chainId
  }
  
  public static getOrderHash(typedData: any): string {
    return _TypedDataEncoder.hash(typedData.domain, typedData.types, typedData.message)
  }
  
  public async signTypedData(account: string, typedData: any): Promise<any> {
    const signer = await this.getSigner(account)
    const typedDataSigner = signer as any
    if (typedDataSigner._signTypedData) {
      const typeSignStr = await typedDataSigner._signTypedData(typedData.domain, typedData.types, typedData.message)
      const signer = ethers.utils.verifyTypedData(typedData.domain, typedData.types, typedData.message, typeSignStr)
      if (account.toLowerCase() !== signer.toLowerCase()) {
        throw Error(`signTypedData failed, account : ${ account }, signer = ${ signer }`)
      }
      return ethers.utils.splitSignature(typeSignStr)
    } else {
      throw Error('Unsupported signTypedData')
    }
  }
  
  public async ethSend(call: LimitedCallSpec): Promise<TransactionResponse> {
    const transactionRequest: TransactionRequest = {
      from: call.from,
      to: call.to,
      data: call.data
    }
    
    if (call.value && ethers.BigNumber.from(call.value).gt(0)) {
      transactionRequest.value = ethers.BigNumber.from(call.value)
    }
    
    const signer = await this.getSigner(call.from)
    
    if (call.maxFeePerGas && call.maxPriorityFeePerGas) {
      transactionRequest.maxFeePerGas = ethers.BigNumber.from(call.maxFeePerGas)
      transactionRequest.maxPriorityFeePerGas = ethers.BigNumber.from(call.maxPriorityFeePerGas)
    } else if (call.gasPrice) {
      transactionRequest.gasPrice = ethers.BigNumber.from(call.gasPrice)
    } else {
      if (!(this.signer instanceof ethers.providers.Web3Provider)) {
        const gas = await estimateGas(this.chainId)
        if (gas) {
          transactionRequest.maxFeePerGas = gas.maxFeePerGas
          transactionRequest.maxPriorityFeePerGas = gas.maxPriorityFeePerGas
        }
      }
    }
    return await signer.sendTransaction(transactionRequest)
  }
  
  public async getSigner(account?: string): Promise<Signer> {
    let signer
    if (this.signer instanceof ethers.providers.Web3Provider) {
      let accounts = await this.signer.listAccounts()
      if (!accounts?.length) {
        accounts = await this.signer.send('eth_requestAccounts', [])
        if (!accounts?.length) {
          throw Error(`getSigner failed, accounts:${ accounts }`)
        }
      }
      
      if (account) {
        if (!accounts.find(item => item.toString().toLowerCase() === account.toLowerCase())) {
          throw Error(`Account mismatch, account:${ account.toLowerCase() }, but connected accounts:${ accounts }`)
        }
        signer = this.signer.getSigner(account)
      } else {
        signer = this.signer.getSigner(accounts[0])
      }
      
      if (this.signer.provider?.isMetaMask && this.signer.provider?.request) {
        const chainId = await signer.getChainId()
        if (chainId != this.chainId) {
          await this.signer.provider.request({
            method: 'wallet_switchEthereumChain',
            params: [ { chainId: '0x' + Number(this.chainId).toString(16) } ]
          })
        } else {
          return signer
        }
      }
    } else {
      signer = this.signer
      const signerAddress = await signer.getAddress()
      if (account) {
        if (account.toLowerCase() !== signerAddress.toLowerCase()) {
          throw Error(`Account mismatch, account: ${ account.toLowerCase() }, but signer: ${ signerAddress.toLowerCase() }`)
        }
      }
    }
    
    const chainId = await signer.getChainId()
    if (chainId != this.chainId) {
      throw Error(`chainId mismatch, chainId: ${ chainId }, but expected chainId: ${ this.chainId }`)
    }
    return signer
  }
  
  public async getCurrentAccount(): Promise<string> {
    let signer
    if (this.signer instanceof ethers.providers.Web3Provider) {
      let accounts = await this.signer.listAccounts()
      if (accounts?.length) {
        return accounts[0].toLowerCase()
      }
      
      accounts = await this.signer.send('eth_requestAccounts', [])
      if (accounts?.length) {
        return accounts[0].toLowerCase()
      }
      throw Error('getCurrentAccount failed, please connect web3, and choose a account.')
    } else {
      signer = this.signer
      const account = await signer.getAddress()
      return account.toLowerCase()
    }
  }
  
  public async approveERC20Proxy(account: string, erc20Address: string, spender: string, gasParams?: GasParams, allowance?: string): Promise<TransactionResponse> {
    const amount = allowance || ethers.constants.MaxInt256.toString()
    const transaction = await erc20Contract.populateTransaction.approve(spender, amount)
    if (transaction.data) {
      return this.ethSend({
        from: account,
        to: erc20Address,
        data: transaction.data,
        gasPrice: gasParams?.gasPrice,
        maxFeePerGas: gasParams?.maxFeePerGas,
        maxPriorityFeePerGas: gasParams?.maxPriorityFeePerGas
      })
    }
    throw Error(`approveERC20Proxy failed, account=${ account }, erc20Address =${ erc20Address }, spender=${ spender }.`)
  }
  
  public async approveERC721Proxy(account: string, erc721Address: string, operator: string, gasParams?: GasParams, approved = true): Promise<TransactionResponse> {
    const transaction = await erc721Contract.populateTransaction.setApprovalForAll(operator, approved)
    if (transaction.data) {
      return this.ethSend({
        from: account,
        to: erc721Address,
        data: transaction.data,
        gasPrice: gasParams?.gasPrice,
        maxFeePerGas: gasParams?.maxFeePerGas,
        maxPriorityFeePerGas: gasParams?.maxPriorityFeePerGas
      })
    }
    throw Error(`approveERC721Proxy failed, account=${ account }, erc721Address =${ erc721Address }, operator=${ operator }.`)
  }
  
  public async approveERC1155Proxy(account: string, erc1155Address: string, operator: string, gasParams: GasParams, approved = true): Promise<TransactionResponse> {
    const transaction = await erc1155Contract.populateTransaction.setApprovalForAll(operator, approved)
    if (transaction.data) {
      return this.ethSend({
        from: account,
        to: erc1155Address,
        data: transaction.data,
        gasPrice: gasParams?.gasPrice,
        maxFeePerGas: gasParams?.maxFeePerGas,
        maxPriorityFeePerGas: gasParams?.maxPriorityFeePerGas
      })
    }
    throw Error(`approveERC1155Proxy failed, account=${ account }, erc1155Address =${ erc1155Address }, operator=${ operator }.`)
  }
}
