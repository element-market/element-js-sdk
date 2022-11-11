import { JsonRpcProvider } from '@ethersproject/providers'

export class TimeoutError extends Error {
    public code: number
    
    constructor(message?: string) {
        super(message)
        this.name = 'TimeoutError'
        this.code = 10000
    }
}

export class TimeoutJsonRpcProvider extends JsonRpcProvider {
    
    send(method: string, params: Array<any>): Promise<any> {
        const timeout = getFunctionTimeout(method)
        if (timeout == 0) {
            return super.send(method, params)
        }
        
        let timer: any
        const timerPromise = new Promise((resolve, reject) => {
            timer = setTimeout(() => {
                reject(new TimeoutError(`RPC request(${method}) is timeout after ${timeout} ms, please check your network.`))
            }, timeout)
        })
        const clearTimer = () => {
            if (timer) {
                clearTimeout(timer)
                timer = null
            }
        }
        
        return Promise.race([super.send(method, params), timerPromise])
            .then((r) => {
                clearTimer()
                return r
            }).catch((error) => {
                clearTimer()
                throw error
            }).finally(() => {
                clearTimer()
            })
    }
    
    async perform(method: string, params: any): Promise<any> {
        try {
            return await super.perform(method, params)
        } catch (error: any) {
            if (error?.error instanceof TimeoutError) {
                throw error?.error
            }
            throw error
        }
    }
}

function getFunctionTimeout(method: string) {
    switch (method) {
        case 'eth_chainId':
            return 4000
        case 'net_version':
            return 2000
        
        case 'eth_blockNumber':
        case 'eth_getBalance':
        case 'eth_gasPrice':
        case 'eth_getTransactionCount':
        case 'eth_getBlockByNumber':
        case 'eth_getBlockByHash':
        case 'eth_getTransactionByHash':
        case 'eth_getTransactionReceipt':
            return 6000
        
        case 'eth_call':
            return 9000
        
        case 'eth_estimateGas':
            return 15000
    }
    return 0
}
