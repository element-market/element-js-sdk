import { ElementSDK, Network, OrderResponse } from '../index'
import { ethers } from 'ethers'

const chain = Network.ETH;
const rpc_url = 'https://mainnet.infura.io/v3/{apiKey}';
const isTestnet = false;

const privateKeys = [
    '',
    '',
];

const apiKey = '';
const assetId = '';
const assetAddress = '';

async function test() {
    const order = await makeSellOrder();
    await fillOrder(order);
}

async function makeSellOrder(): Promise<OrderResponse> {
    const sdk = createSDK(privateKeys[0]);
    const order = await sdk.makeSellOrder({
        assetId: assetId,
        assetAddress: assetAddress,
        startTokenAmount: 1e17,
    });
    console.log("makeSellOrder, order: ", order);
    return order;
}

async function fillOrder(order: OrderResponse) {
    const sdk = createSDK(privateKeys[1]);
    const tx = await sdk.fillOrder({
        order: order
    });
    console.log("fillOrder, tx: ", tx);
}

function createSDK(privateKey?: string) {
    if (typeof(window) == 'object') {
        // browser
        return new ElementSDK({
            networkName: chain,
            isTestnet: isTestnet,
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
