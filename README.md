<p align="center">
  <img src="https://www.element.market/build/logo-header-268a92cd.svg" height="60"/>
</p>

# Element.js <!-- omit in toc -->

![https://badges.frapsoft.com/os/mit/mit.svg?v=102](https://badges.frapsoft.com/os/mit/mit.svg?v=102)

A JavaScript library for element.market: buy, sell, make offer on any NFTs. With Element.js, you can easily build your own NFT marketplace. Trade ERC721 or ERC1155 items. You don't have to deploy your own smart contracts or off-chain orderbooks.

Published on [GitHub](https://github.com/element-market/element-js-sdk) and [npm](https://www.npmjs.com/package/element-js-sdk)

- [Synopsis](#synopsis)
- [Installation](#installation)
- [Getting Started](#getting-started)
  - [Making Listings / Selling Items](#making-listings--selling-items)
    - [Creating Dutch Auctions](#creating-dutch-auctions)
    - [Creating English Auctions](#creating-english-auctions)
  - [Making Offers](#making-offers)
    - [Making Collection-Based Offers](#making-collection-based-offers)
  - [Fetching Orders](#fetching-orders)
  - [Filling Orders](#filling-orders)
  - [Cancel Orders](#cancel-orders)
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
const webpackConfig = {
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
};
```

## Getting Started

To get started, first request an API key [here](https://element.readme.io/reference/api-overview). 

Then, create a new ElementJS client, using your [ethers](https://docs.ethers.io/v5) web3Provider or signer:

```JavaScript
import { ElementSDK, Network } from 'element-js-sdk'
import { ethers } from 'ethers'

// In Browser
// https://docs.ethers.io/v5/getting-started/#getting-started--connecting
// A Web3Provider wraps a standard Web3 provider, which is what MetaMask injects as window.ethereum into each page.
const signerOrProvider = new ethers.providers.Web3Provider(window.ethereum); 

// In Node.js
// https://docs.ethers.io/v5/api/signer/
const jsonRpcProvider = new ethers.providers.JsonRpcProvider('https://mainnet.infura.io/v3/${providerApiKey}');
const signerOrProvider = new ethers.Wallet(privateKey, jsonRpcProvider);

const sdk = new ElementSDK({
  // Supported networks: Network.ETH, Network.BSC, Network.Polygon, Network.Avalanche
  networkName: Network.ETH, 
  apiKey: YOUR_API_KEY,
  signer: signerOrProvider
});
```

Note that the operations: `sign orders` `erc20.approve` `erc721.setApprovalForAll` `erc1155.setApprovalForAll` done inside this sdk.

### Making Listings / Selling Items

To sell an asset, call `makeSellOrder`.

```JavaScript
const order = await sdk.makeSellOrder({
  assetId: assetId,
  assetAddress: assetAddress,
  // Value of the listing, in units of the payment token (or native token if none is specified).
  // The units are wei, and the type is string or number(e.g. 3e19).
  startTokenAmount: '3000000000000000000'
});
```

Note that the default assets is ERC-721, for ERC-1155 assets, you can set `assetSchema` to `AssetSchema.ERC1155` and pass a `quantity`:

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
  paymentToken: 'xxxx'
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

#### Creating Dutch Auctions

To create a Dutch Auction, you should set `saleKind` to `SaleKind.DutchAuction` and set `endTokenAmount` to a small amount:

```JavaScript
const order = await sdk.makeSellOrder({
  assetId: assetId,
  assetAddress: assetAddress,
  saleKind: SaleKind.DutchAuction,
  startTokenAmount: '3000000000000000000',
  endTokenAmount: '1000000000000000000'
});
```

#### Creating English Auctions

English Auctions are auctions that start at a small amount and increase with every bid. At expiration time, the item sells to the highest bidder.

To create an English Auction, you should set `saleKind` to `SaleKind.EnglishAuction` and set `endTokenAmount` to a bigger amount:

```JavaScript
const order = await sdk.makeSellOrder({
  assetId: assetId,
  assetAddress: assetAddress,
  saleKind: SaleKind.EnglishAuction,
  startTokenAmount: '3000000000000000000',
  endTokenAmount: '5000000000000000000'
});
```

### Making Offers

You can make offers on an asset:

```JavaScript
const order = await sdk.makeBuyOrder({
  assetId: assetId,
  assetAddress: assetAddress,
  // Value of the order, in units of the payment token (or wrapped native token if none is specified).
  startTokenAmount: '3000000000000000000'
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
  startTokenAmount: '3000000000000000000'
});
```

### Fetching Orders

To retrieve a list of offers and auction on an asset, you can use an instance of the `ElementSDK` exposed on the client. Parameters passed into API filter objects are similar to the main [element.market api parameters](https://api.element.market/openapi/):

```JavaScript
import { ElementSDK } from 'element-js-sdk'

const { count, orders } = await sdk.queryOrders({
  asset_contract_address: assetAddress,
  token_id: assetId
});
```

The available API filters for the orders endpoint is documented in the `OrderQuery` interface below, but see the main [API Docs](https://api.element.market/openapi/#/Orders/orders) for a playground, along with more up-to-date and detailed explanantions.

```TypeScript
interface OrderQuery {
  // Filter by smart contract address for the asset category.
  asset_contract_address?: string;
  token_id?: string | number;
  // Filter by a list of token IDs for the order's asset, Needs to be defined together with asset_contract_address.
  token_ids?: Array<string | number>;
  // Filter by the kind of sell order. 0 for fixed-price sales, 1 for declining-price Dutch Auctions, 2 for English Auctions
  sale_kind?: SaleKind;
  // Filter by the side of the order. 0 for buy orders and 1 for sell orders.
  side?: OrderSide;
  // Filter by the order maker's wallet address
  maker?: string;
  // Filter by the order maker's wallet address
  taker?: string;
  // Filter by the address of the smart contract of the payment token that is accepted
  // or offered by the order, Eth and other primary chain currencies are 0x0000000000000000000000000000000000000000
  payment_token?: string;
  // How to sort the orders. Can be created_date for when they were made,
  // or base_price to see the lowest-priced orders first. use with direction,
  // created_date is default.
  order_by?: string;
  // Can be asc or desc for ascending or descending sort. Default value : desc
  direction?: string;
  // Only show orders listed before this timestamp. Seconds since the Unix epoch.
  listed_before?: number | string;
  // Only show orders listed after this timestamp. Seconds since the Unix epoch.
  listed_after?: number | string;
  // Number of orders to return (capped at 50, default is 20). Default value: 20
  limit?: number;
  // Number of orders to offset by (for pagination). Default value: 0
  offset?: number;
}
```

### Filling Orders

To buy or sell NFT, you need to fill a sell order or buy order. To do that, it's just one call:

```JavaScript
const { count, orders } = await sdk.queryOrders({ ... });
const order = orders[0]; // select an order
const transactionReceipt = await sdk.fillOrder({
  order: order
});
```

Note that if the order is a Collection-Based Offer, you need specify the `assetId`:

```JavaScript
const assetId = '';
const transactionReceipt = await sdk.fillOrder({
  order: order,
  assetId: assetId
});
```

Note that the ERC-1155 assets order can be filled partial, so that, for the ERC-1155 assets order, you need passed in the `quantity` to be fill:

```JavaScript
const quantity = '5000';
const transactionReceipt = await sdk.fillOrder({
  order: order,
  quantity: quantity
});
```

### Cancel Orders

To cancel an order, call `cancelOrder`. Note that only the maker of a given order may cancel it.

```JavaScript
const { count, orders } = await sdk.queryOrders({ ... });
const order = orders[0]; // select an order
const transactionReceipt = await sdk.cancelOrder({
  order: order
});
```

To cancel all orders of the sdk signer, you need to increase a counter named `HashNonce`. To do that, it's just call like below:

```JavaScript
const transactionReceipt = await sdk.cancelAllOrders();
```

## Advanced

Interested in purchasing for scheduling future orders, or private auctions, element.js can help with that.

### User-Defined GasPrice

You can set `maxFeePerGas` and `maxPriorityFeePerGas`(EIP-1559), or just set `gasPrice`.

```JavaScript
const transactionReceipt = await sdk.fillOrder({
  order: order,
  maxFeePerGas: 21e9,       // string or number.
  maxPriorityFeePerGas: 2e9 // string or number.
});
```

```JavaScript
const transactionReceipt = await sdk.fillOrder({
  order: order,
  gasPrice: '30000000000', // string or number.
});
```

Supported methods: `fillOrder`, `cancelOrder`, `cancelAllOrders`, `makeSellOrder`, `makeBuyOrder`.

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

Note that English Auctions aren't supported with `listingTime`.

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

The documentation for developer is available [here](https://docs.element.market/developer/).

If you need extra help, support is free! You can email us `api@element.market`.
