import axios from 'axios'

export async function estimateGas(chainId: number) {
    if (chainId == 137) {
        return estimateGasPolygon()
    }
}

async function estimateGasPolygon() {
    try {
        const response = await axios({
            method: 'get',
            url: 'https://gasstation-mainnet.matic.network/v2',
            timeout: 5000
        })
        const obj = await response.data
        const fastMaxPriorityFee = Number.parseFloat(obj.fast.maxPriorityFee)
        const baseFee = Number.parseFloat(obj.estimatedBaseFee)
        
        let maxPriorityFee = Math.floor(fastMaxPriorityFee * 1e9)
        let estimatedBaseFee
        if (baseFee >= 10) {
            estimatedBaseFee = Math.floor(baseFee * 1.125 * 1e9)
        } else if (baseFee >= 5) {
            estimatedBaseFee = Math.floor(baseFee * 1.5 * 1e9)
        } else {
            estimatedBaseFee = Math.floor(baseFee * 2 * 1e9)
        }
        return {
            maxFeePerGas: (maxPriorityFee + estimatedBaseFee),
            maxPriorityFeePerGas: maxPriorityFee
        }
    } catch (e) {
    }
}
