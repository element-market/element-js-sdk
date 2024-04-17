import axios from 'axios'
import { OrderRequest } from '../element/order/orderTypes'
import { API_HOST, API_HOST_TESTNET, ApiOption, Fees, NonceQuery, OrderQuery, TIME_OUT } from './openApiTypes'
import { Order } from '../types/types'
import { BatchSignedERC721OrderRequest } from '../element/batchSignedOrder/batchSignedTypes'

export async function postOrder(order: OrderRequest, option: ApiOption, retries = 1) {
  let r
  try {
    console.log('Wait for postOrder.')
    r = await axios({
      method: 'post',
      url: toUrl('/openapi/v1/orders/post', option),
      headers: { 'x-api-key': option.apiKey },
      data: order,
      timeout: TIME_OUT
    })
  } catch (e) {
    if (shouldRetry(e, retries)) {
      console.log('postOrder failed, ' + e + ', now try again.')
      await sleep(1000)
      return postOrder(order, option, retries - 1)
    }
    throw Error(`postOrder failed, ${ e }, order: ${ JSON.stringify(order) }`)
  }
  if (r.data?.code !== 0) {
    throw Error(`postOrder failed, ${ r.data?.code }, ${ r.data?.msg }, ${ JSON.stringify(order) }`)
  }
  console.log('postOrder completed.')
  return r.data.data
}

export async function postBatchSignedERC721SellOrder(order: BatchSignedERC721OrderRequest, option: ApiOption, retries = 1): Promise<any> {
  let r
  try {
    console.log('Wait for postBatchOrder.')
    r = await axios({
      method: 'post',
      url: toUrl('/openapi/v1/orders/postBatch', option),
      headers: { 'x-api-key': option.apiKey },
      data: order,
      timeout: TIME_OUT
    })
  } catch (e) {
    if (shouldRetry(e, retries)) {
      console.log('postBatchOrder failed, ' + e + ', now try again.')
      await sleep(1000)
      return postBatchSignedERC721SellOrder(order, option, retries - 1)
    }
    throw Error(`postBatchOrder failed, ${ e }, order: ${ order }`)
  }
  
  if (r.data?.code === 0 && r.data?.data) {
    console.log('postBatchOrder completed.')
    return {
      successList: r.data.data.successList || [],
      failList: r.data.data.failList || []
    }
  }
  throw Error(`postBatchOrder failed, ${ r.data?.code }, ${ r.data?.msg }, ${ JSON.stringify(order) }`)
}

export async function queryTradeData(
  account: string,
  list: Array<{
    orderId: String;
    takeCount: number;
    tokenId?: string;
  }>,
  option: ApiOption,
  retries = 1
): Promise<any> {
  let r
  try {
    r = await axios({
      method: 'post',
      url: toUrl('/openapi/v1/orders/encodeTradeDataByOrderId', option),
      headers: { 'x-api-key': option.apiKey },
      data: {
        chain: option.chain,
        taker: account.toLowerCase(),
        orderIdList: list
      },
      timeout: TIME_OUT
    })
  } catch (e) {
    if (shouldRetry(e, retries)) {
      console.log('encodeTradeData failed, ' + e + ', now try again.')
      await sleep(1000)
      return queryTradeData(account, list, option, retries - 1)
    }
    throw Error(`encodeTradeData failed, ${ e }`)
  }
  if (r.data?.code === 0 && r.data?.data) {
    return r.data?.data
  }
  throw Error(`encodeTradeData failed, ${ r.data?.code }, ${ r.data?.msg }`)
}

export async function queryNonce(query: NonceQuery, option: ApiOption, retries = 1): Promise<number> {
  let r
  try {
    const url = toUrl(`/openapi/v1/orders/nonce?chain=${ option.chain }`, option)
      + toKeyVal('maker', query)
      + toKeyVal('exchange', query)
      + toKeyVal('schema', query)
      + toKeyVal('count', query)
    r = await axios({
      method: 'get',
      url: url,
      headers: { 'x-api-key': option.apiKey },
      timeout: TIME_OUT
    })
  } catch (e) {
    if (shouldRetry(e, retries)) {
      console.log('queryNonce failed, ' + e + ', now try again.')
      await sleep(1000)
      return queryNonce(query, option, retries - 1)
    }
    throw Error('queryNonce failed, ' + e)
  }
  
  if (r.data?.code === 0 && r.data?.data?.nonce != null) {
    console.log('queryNonce, nonce: ' + r.data.data.nonce.toString())
    return Number(r.data.data.nonce.toString())
  }
  throw Error('queryNonce failed, ' + r.data?.msg)
}

export async function queryOracleSignature(option: ApiOption, retries = 1): Promise<number> {
  let r
  try {
    const url = toUrl(`/openapi/v1/orders/confData?chain=${ option.chain }`, option)
    r = await axios({
      method: 'get',
      url: url,
      headers: { 'x-api-key': option.apiKey },
      timeout: TIME_OUT
    })
    if (r.data?.data?.oracleSignature != null) {
      console.log('queryOracleSignature success, oracleSignature: ' + r.data.data.oracleSignature)
      return Number(r.data.data.oracleSignature)
    }
  } catch (e) {
    if (shouldRetry(e, retries)) {
      console.log('queryOracleSignature failed, ' + e + ', now try again.')
      await sleep(1000)
      return queryOracleSignature(option, retries - 1)
    }
  }
  console.log('queryOracleSignature failed, use default value `0`')
  return 0
}

export async function queryFees(contractAddressList: string[], option: ApiOption, retries = 1): Promise<Array<Fees>> {
  let r
  try {
    r = await axios({
      method: 'post',
      url: toUrl('/openapi/v1/collection/fee', option),
      headers: { 'x-api-key': option.apiKey },
      data: {
        chain: option.chain,
        data: contractAddressList.map(value => {
          return {
            contractAddress: value.toLowerCase()
          }
        })
      },
      timeout: TIME_OUT
    })
  } catch (e) {
    if (shouldRetry(e, retries)) {
      console.log('queryFees failed, ' + e + ', now try again.')
      await sleep(1000)
      return queryFees(contractAddressList, option, retries - 1)
    }
    throw Error('queryFees failed, ' + e)
  }
  
  if (r.data?.code === 0) {
    return r.data?.data?.feeList || []
  }
  throw Error('queryFees failed, ' + r.data?.msg)
}

export async function queryOrders(query: OrderQuery, option: ApiOption): Promise<Array<Order>> {
  const url = toUrl(`/openapi/v1/orders/list?chain=${ option.chain }`, option)
    + toKeyVal('asset_contract_address', query)
    + toTokenIdsKeyVal('token_ids', query)
    + toKeyVal('sale_kind', query)
    + toKeyVal('side', query)
    + toKeyVal('maker', query)
    + toKeyVal('taker', query)
    + toKeyVal('payment_token', query)
    + toKeyVal('order_by', query)
    + toKeyVal('direction', query)
    + toKeyVal('listed_before', query)
    + toKeyVal('listed_after', query)
    + toKeyVal('limit', query)
    + toKeyVal('offset', query)
  
  let r
  try {
    r = await axios({
      method: 'get',
      url: url,
      headers: { 'x-api-key': option.apiKey },
      timeout: TIME_OUT
    })
  } catch (e) {
    throw Error('queryOrders failed, ' + e)
  }
  
  if (r.data?.code === 0 && r.data?.data?.orders) {
    return r.data?.data?.orders
  }
  throw Error('queryOrders failed, ' + r.data?.msg)
}

function toUrl(path: string, option: ApiOption): string {
  return !option.isTestnet ? (API_HOST + path) : (API_HOST_TESTNET + path)
}

function sleep(ms: number) {
  return Promise.resolve(resolve => setTimeout(resolve, ms))
}

function toTokenIdsKeyVal(key: string, query: any): string {
  let val = ''
  if (query[key]?.length) {
    for (const id of query[key]) {
      const idStr = formatVal(id)
      if (idStr != '') {
        if (val != '') {
          val += ','
        }
        val += idStr
      }
    }
  }
  return val != '' ? `&${ key }=${ val }` : ''
}

function toKeyVal(key: string, query: any): string {
  const val = formatVal(query[key])
  return val != '' ? `&${ key }=${ val }` : ''
}

function formatVal(value: any): string {
  return value != null ? value.toString().toLowerCase() : ''
}

function shouldRetry(error, retries: number): boolean {
  if (retries > 0) {
    if (error?.message?.toString().startsWith('timeout of')) {
      return true
    }
    if (error?.response) {
      const status = error?.response.status
      return (
        status == 403 || status == 429 ||
        status == 500 || status == 502 || status == 503 || status == 504
      )
    }
  }
  return false
}
