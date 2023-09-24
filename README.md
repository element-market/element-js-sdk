# Element.js <!-- omit in toc -->

A JavaScript library for element.market: buy, sell, make offer on any NFTs. With Element.js, you can easily build yourown NFT marketplace. Trade ERC721 or ERC1155 items. You don't have to deploy your own smart contracts or off-chain orderbooks.

Published on [GitHub](https://github.com/element-market/element-js-sdk) and [npm](https://www.npmjs.com/package/element-js-sdk)

- [Synopsis](#synopsis)
- [Installation](#installation)
- [Getting Started](#getting-started)
    - [Making Listings](#making-listings)
    - [Making Offers](#making-offers)
    - [Fetching Orders](#fetching-orders)
    - [Fill Orders](#fill-orders)
    - [Cancel Orders](#cancel-orders)
    - [Encode Trade Data](#encode-trade-data)
- [Advanced](#advanced)
    - [User-Defined GasPrice](#user-defined-gasprice)
    - [Scheduling Future Listings](#scheduling-future-listings)
    - [Private Auctions](#private-auctions)
- [Learning More](#learning-more)

## Synopsis

This is the JavaScript SDK for [element.market](https://www.element.market/), a marketplace for NFTs.

It allows developers to access the official orderbook, filter it, create buy orders (**offers**), create sell orders (**listings**), and complete trades programmatically.

You get started by [requesting an API key](https://element.readme.io/reference/api-overview) and instantiating your own sdk. Then you can create orders off-chain or fulfill orders on-chain.

## Installation

Install [element-js-sdk](https://www.npmjs.com/package/element-js-sdk), in your project, run:

```bash
npm install --save element-js-sdk
```

If your project run in browser environment, you need install [crypto-browserify](https://www.npmjs.com/package/crypto-browserify), [stream-browserify](https://www.npmjs.com/package/stream-browserify), [buffer](https://www.npmjs.com/package/buffer), and config webpack.config.js:

```bash
#install crypto-browserify, stream-browserify, buffer
npm install --save crypto-browserify
npm install --save stream-browserify
npm install --save buffer
```

```bash
#config webpack.config.js
module.exports = function (webpackEnv) {
  ...
  return {
    ...
    resolve: {
        ...
        fallback: {
            crypto: require.resolve("crypto-browserify"),
            stream: require.resolve("stream-browserify"),
            buffer: require.resolve('buffer/'),
        },
    },
    ...
    plugins: [
        ...
        new webpack.ProvidePlugin({
            Buffer: ['buffer', 'Buffer'],
        }),
    ],
  }
};
```

## Getting Started

To get started, first request an API key [here](https://element.readme.io/reference/api-overview).

Then, create a new ElementJS client, using your [ethers](https://docs.ethers.io/v5) web3Provider or signer:

Note that, the default `web3Provider` does not check for network timeout. To do that, refer to the [TimeoutWeb3Provider](https://github.com/element-market/element-js-sdk/blob/main/examples/TimeoutWeb3Provider.ts).

```JavaScript
import { ElementSDK, Network } from 'element-js-sdk'
import { ethers } from 'ethers'

// In Browser
// https://docs.ethers.io/v5/getting-started/#getting-started--connecting-rpc
// A Web3Provider wraps a standard Web3 provider, which is what MetaMask injects as window.ethereum into each page.
// const signerOrProvider = new ethers.providers.Web3Provider(window.ethereum);
const signerOrProvider = new TimeoutWeb3Provider(window.ethereum);

// In Node.js
// https://docs.ethers.io/v5/api/signer/
const jsonRpcProvider = new ethers.providers.JsonRpcProvider(rpcUrl);
const signerOrProvider = new ethers.Wallet(privateKey, jsonRpcProvider);

const sdk = new ElementSDK({
  // Supported networks: Network.ETH, Network.BSC, Network.Polygon, Network.Avalanche
  networkName: Network.ETH,
  isTestnet: false,
  apiKey: YOUR_API_KEY,
  signer: signerOrProvider
});
```

Note that the operations: `sign orders` `erc20.approve` `erc721.setApprovalForAll` `erc1155.setApprovalForAll` is done inside this sdk.

### Making Listings

To sell a bulk of ERC-721 assets, call `makeERC721SellOrders`.

```JavaScript
const r = await sdk.makeERC721SellOrders({
  items: [{
    erc721TokenAddress: tokenAddress1,
    erc721TokenId: tokenId1,
    paymentTokenAmount: '1100000000000000000'
  }, {
    erc721TokenAddress: tokenAddress2,
    erc721TokenId: tokenId2,
    paymentTokenAmount: 1200000000000000000
  }, {
    erc721TokenAddress: tokenAddress3,
    erc721TokenId: tokenId3,
    paymentTokenAmount: 1.3e18
  }]
});
console.log("succeedList, ", r.succeedList);
console.log("failedList, ", r.failedList);
```

To sell an asset, call `makeSellOrder`.

```JavaScript
const order = await sdk.makeSellOrder({
  assetAddress: tokenAddress,
  assetId: tokenId,
  paymentTokenAmount: '2000000000000000000'
});
```

Note that the default assets is ERC-721. For ERC-1155 assets, you should set `assetSchema` to `AssetSchema.ERC1155` and pass a `quantity`:

```JavaScript
const order = await sdk.makeSellOrder({
  // ...
  assetSchema: AssetSchema.ERC1155,
  quantity: 10000,
});
```

The default payment token is native token(e.g. ETH on ether chain), if use an ERC20 token, you can set `paymentToken` to an ERC20 token address.

```JavaScript
const order = await sdk.makeSellOrder({
  // ...
  paymentToken: paymentToken
});
```

The default expiration time is 7 days, you can set `expirationTime` to specify another expiration time.

```JavaScript
// Note that we convert from the JavaScript timestamp (milliseconds to seconds):
const expirationTime = Math.round(Date.now() / 1000 + 60 * 60 * 24);
const order = await sdk.makeSellOrder({
  // ...
  expirationTime: expirationTime
});
```

### Making Offers

You can make offers on an asset:

```JavaScript
const order = await sdk.makeBuyOrder({
  assetId: assetId,
  assetAddress: assetAddress,
  paymentTokenAmount: '3000000000000000000'
});
```

Note that make offers aren't supported with the native token, so you have to use an ERC20 token, or wrapped native token if none is specified.

#### Making Collection-Based Offers

You can make offers for any NFT from a specific collection.

```JavaScript
const order = await sdk.makeBuyOrder({
  // Note that don't specify the `assetId`
  assetAddress: assetAddress,
  // Value of the order, in units of the payment token (or wrapped native token if none is specified).
  paymentTokenAmount: '3000000000000000000'
});
```

### Fetching Orders

To fetching orders of the element market, call `queryOrders`:

```JavaScript
import { ElementSDK } from 'element-js-sdk'

const orders = await sdk.queryOrders({
  asset_contract_address: assetAddress,
  token_ids: [assetId]
});
```

The api documentation is [here](https://element.readme.io/reference/retrieve-orders-list), and the example is [here](https://github.com/element-market/element-js-sdk/tree/main/examples/8.querylOrders.ts).

### Fill Orders

To buy a bulk of NFTs, call `batchBuyWithETH`:

```JavaScript
const orders = await sdk.queryOrders({ ... });
const transaction = await sdk.batchBuyWithETH({
  orders: orders
});
console.log("tx.hash: ", transaction.hash);

// wait for transaction completed.
const receipt = await transaction.wait();
console.log("completed，receipt: ", receipt);

// getBoughtAssets
const assets = sdk.getBoughtAssets(receipt)
console.log('assets: ', assets)
```

To buy or sell a NFT, call `fillOrder`:

```JavaScript
const orders = await sdk.queryOrders({ ... });
const order = orders[0]; // select an order
const transaction = await sdk.fillOrder({
  order: order
});
console.log("tx.hash: ", transaction.hash);
const receipt = await transaction.wait();
console.log("completed，receipt: ", receipt);
```

Note that if the order is a Collection-Based Offer, you need specify the `assetId`:

```JavaScript
const transaction = await sdk.fillOrder({
  order: order,
  assetId: assetId
});
const receipt = await transaction.wait();
console.log("completed.");
```

For the ERC-1155 asset order, the default `quantity` is all the remaining quantity. You can also set the `quantity` if needed. To do that, it's just call like below:

```JavaScript
const quantity = '5000';
const transaction = await sdk.fillOrder({
  order: order,
  quantity: quantity
});
const receipt = await transaction.wait();
console.log("completed");
```

### Cancel Orders

To cancel an order, call `cancelOrder`.

```JavaScript
const orders = await sdk.queryOrders({ ... });
const order = orders[0]; // select an order
const transaction = await sdk.cancelOrder({
  order: order
});
const receipt = await transaction.wait()
console.log("completed")
```

To cancel a bulk of orders, call `cancelOrders`:

```JavaScript
const orders = await sdk.queryOrders({ ... });
const r = await sdk.cancelOrders({
  orders: orders
})
for (const info of r.succeedTransactions) {
  console.log('tx.hash: ', info.transaction.hash)
  const receipt = await info.transaction.wait()
  console.log('completed， receipt: ', receipt)
  console.log('orders: ', info.orders)
}
```

To cancel all orders of the signer, call `cancelAllOrdersForSigner`:

```JavaScript
const transaction = await sdk.cancelAllOrdersForSigner({
  // Supported Standard: Standard.ElementEx, Standard.Seaport, Standard.LooksRare
  standard: Standard.ElementEx
});
const receipt = await transaction.wait()
console.log("completed")
```

### Encode Trade Data

If you want to get `TradeData`, call `encodeTradeData`.

```JavaScript
const orders = await sdk.queryOrders({ ... });
const tradeData = await sdk.encodeTradeData({
  orders: orders,
  taker: accountAddress
});
console.log("tradeData: ", tradeData);

// sendTransaction
const signer = await getEthersSigner()
const transaction = await signer.sendTransaction({
  to: tradeData.toContract,
  data: tradeData.data,
  value: tradeData.payableValue
})

// wait for transaction completed.
const receipt = await transaction.wait();
console.log("completed，receipt: ", receipt);

// getBoughtAssets
const assets = sdk.getBoughtAssets(receipt)
console.log('assets: ', assets)
```

Note that the `taker` is optional, and the default `taker` is sdk.signer.

## Advanced

Interested in purchasing for scheduling future orders, or private auctions, element.js can help with that.

### User-Defined GasPrice

You can set `maxFeePerGas` and `maxPriorityFeePerGas`(EIP-1559), or just set `gasPrice`.

```JavaScript
const transaction = await sdk.fillOrder({
  order: order,
  maxFeePerGas: 21e9,       // string or number.
  maxPriorityFeePerGas: 2e9 // string or number.
});
const receipt = await transaction.wait();
console.log("completed");
```

```JavaScript
const transaction = await sdk.fillOrder({
  order: order,
  gasPrice: '30000000000', // string or number.
});
const receipt = await transaction.wait();
console.log("completed");
```

### Scheduling Future Listings

You can create sell orders that aren't fulfillable until a future date. Just pass in a `listingTime` (a UTC timestamp in seconds) to your sdk instance:

```JavaScript
const order = await sdk.makeSellOrder({
  assetId: assetId,
  assetAddress: assetAddress,
  startTokenAmount: 3e19,
  listingTime: Math.round(Date.now() / 1000 + 60 * 60 * 24) // One day from now
});
```

### Private Auctions

Now you can make offers and listings that can only be filled by an address of your choosing. This allows you to negotiate a price in some channel and sell for your chosen price on element.market, **without having to trust that the counterparty will abide by your terms!**

Here's an example of listing a Decentraland parcel for 3 ETH with a specific buyer address allowed to take it. No more needing to worry about whether they'll give you enough back!

```JavaScript
// Address allowed to buy from you
const takerAddress = "0x123..."
const order = await sdk.makeSellOrder({
  takerAddress: takerAddress,
  assetId: assetId,
  assetAddress: assetAddress,
  startTokenAmount: 3e19
});
```

## Learning More

The examples are [here](https://github.com/element-market/element-js-sdk/tree/main/examples).

The documentation for developer is available [here](https://docs.element.market/developer/).

If you need extra help, support is free! You can email us `api@element.market`.
