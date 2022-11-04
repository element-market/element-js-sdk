export { ContractABI } from './abi/index'

export const CONTRACTS_ADDRESSES = {
    1: {
        ElementEx: '0x20F780A973856B93f63670377900C1d2a50a77c4',
        ElementExSwapV2: '0xb4E7B8946fA2b35912Cc0581772cCCd69A33000c',
        Helper: '0x68dc8D3ab93220e84b9923706B3DDc926C77f1Df',
        WToken: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        Seaport: '0x00000000006c3852cbef3e08e8df289169ede581',
        LooksRare: '0x59728544b08ab483533076417fbbb2fd0b17ce3a'
    },
    5: {
        ElementEx: '0x7Fed7eD540c0731088190fed191FCF854ed65Efa',
        ElementExSwapV2: '0xFb099cE799d8eA457CD7A4401d621C00d87C87fA',
        Helper: '0xC5b1AA9DaD977e156C98acEEE473D45a880c22d3',
        WToken: '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6',
        Seaport: '0x00000000006c3852cbef3e08e8df289169ede581',
        LooksRare: '0xD112466471b5438C1ca2D218694200e49d81D047'
    },
    56: {
        ElementEx: '0xb3e3DfCb2d9f3DdE16d78B9e6EB3538Eb32B5ae1',
        ElementExSwapV2: '0x46A03313FA8eF8ac8798f502bB38d35E5e1acbfC',
        Helper: '0xb54ee46dACE4ecAC1dBC2488B61094B4b3174139',
        WToken: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'
    },
    97: {
        ElementEx: '0x30FAD3918084eba4379FD01e441A3Bb9902f0843',
        ElementExSwapV2: '0x8751796ba398412A1520fa177E421183C49a8780',
        Helper: '0x61311202273f9857685852FC76aEA83294F90a80',
        WToken: '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd'
    },
    137: {
        ElementEx: '0xEAF5453b329Eb38Be159a872a6ce91c9A8fb0260',
        ElementExSwapV2: '0x25956Fd0A5FE281D921b1bB3499fc8D5EFea6201',
        Helper: '0x4D5E03AF11d7976a0494f0ff2F65986d6548fc3e',
        WToken: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270'
    },
    80001: {
        ElementEx: '0x2431e7671d1557d991a138c7af5d4cd223a605d6',
        ElementExSwapV2: '0xA9fF4783fA66bc2774f2c41489BA570EbE82E141',
        Helper: '0xcCcd0afEAfB6625cd655Cf8f39B02c85947dB6f6',
        WToken: '0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889'
    },
    43114: {
        ElementEx: '0x18cd9270DbdcA86d470cfB3be1B156241fFfA9De',
        ElementExSwapV2: '0x917ef4F231Cbd0972A10eC3453F40762C488e6fa',
        Helper: '0x4c95419b74D420841CaaAd6345799522475f91D2',
        WToken: '0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7'
    },
    43113: {
        ElementEx: '0xd089757a20a36B0978156659Cc1063B929Da76aB',
        ElementExSwapV2: '0x786596CFaA0020EC7fFdE499049E3b9981E99f4A',
        Helper: '0x1f66918D87aab33158DBA4b5Dfe73f2245cfDc20',
        WToken: '0xd00ae08403B9bbb9124bB305C09058E32C39A48c'
    }
}

export const RPC_URLS = {
    1: 'https://mainnet.infura.io/v3/083d4f747d934f799e087765b10d7be8',
    5: 'https://goerli.infura.io/v3/083d4f747d934f799e087765b10d7be8',
    56: 'https://bsc-dataseed1.binance.org',
    97: 'https://data-seed-prebsc-1-s1.binance.org:8545',
    137: 'https://polygon-rpc.com',
    80001: 'https://matic-mumbai.chainstacklabs.com',
    43114: 'https://api.avax.network/ext/bc/C/rpc',
    43113: 'https://api.avax-test.network/ext/bc/C/rpc'
}
