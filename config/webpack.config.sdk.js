const HtmlWebpackPlugin = require('html-webpack-plugin')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')
const webpack = require('webpack')
//
// plugins: [
//   new HtmlWebpackPlugin({ template: path.join(__dirname, 'index.html') }),
//   new webpack.HotModuleReplacementPlugin()
// ]
const path = require('path')


module.exports = {
  target: 'web',
  watchOptions: {
    aggregateTimeout: 600,
    ignored: ['**/node_modules']
  },
  mode: 'development',
  entry: './index.ts',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: 'ts-loader',
          options: {
            // 加快编译速度
            transpileOnly: true,
            // 指定特定的ts编译配置，为了区分脚本的ts配置
            configFile: path.resolve(__dirname, '../tsconfig.json')
          }
        },
        exclude: /node_modules/
      }
    ]
  },
  devServer: {
    static: {
      directory: path.join(__dirname, '../dist')
    },
    compress: true,
    port: 9001
  },
  devtool: 'inline-source-map',
  resolve: {
    extensions: ['.ts', '.js', '.tsx', '.json'],
    fallback: {
      'crypto': require.resolve('crypto-browserify'),
      'assert': require.resolve('assert/'),
      'buffer': require.resolve('buffer/'),
      'stream': require.resolve('stream-browserify'),
      'http': require.resolve('stream-http'),
      "https": require.resolve("https-browserify"),
      "os": require.resolve("os-browserify/browser"),
      "url": require.resolve("url/")
    }
  },
  output: {
    path: path.resolve(__dirname, '../dist'),
    filename: 'index.js',
    libraryTarget: 'umd'
  },
  plugins: [
    new CleanWebpackPlugin(),
    // Only update what has changed on hot reload
    new webpack.HotModuleReplacementPlugin(),
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer']
    }),
    new webpack.ProvidePlugin({
      process: 'process/browser'
    }),
    new HtmlWebpackPlugin({ template: './page/index.html' }),
    new CopyWebpackPlugin({ patterns: [{ from: './page/js', to: './js' }] })
  ]

}
