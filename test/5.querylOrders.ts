import { ElementSDK, Network } from '../index'
import { ethers } from 'ethers'

const chain = Network.ETH;
const rpc_url = 'https://mainnet.infura.io/v3/{apiKey}';
const isTestnet = false;

const privateKeys = [
    '',
];

const apiKey = '';

async function test() {
    const sdk = createSDK(privateKeys[0]);
    const { count, orders } = await sdk.queryOrders({
        asset_contract_address: '',
        token_id: ''
    });
    console.log("count = " + count);
    console.log("orders = " + JSON.stringify(orders));
}

function createSDK(privateKey?: string) {
    if (typeof(window) == 'object') {
        // browser
        return new ElementSDK({
            networkName: chain,
            isTestnet: true,
            apiKey: apiKey,
            signer: new ethers.providers.Web3Provider(window['ethereum'])
        });
    } else {
        // node.js
        const provider = new ethers.providers.JsonRpcProvider(rpc_url);
        const signer = new ethers.Wallet(privateKey as string, provider);
        return new ElementSDK({
            networkName: chain,
            isTestnet: isTestnet,
            apiKey: apiKey,
            signer: signer
        });
    }
}

test()
  .then()
  .catch((error) => {
      console.error(error);
      process.exit(1);
  });
