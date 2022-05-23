const HtmlWebpackPlugin = require('html-webpack-plugin')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const {CleanWebpackPlugin} = require('clean-webpack-plugin')
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
    entry: ['./index.ts', './page/app.jsx'],
    module: {
        rules: [
            {
                test: /\.jsx?$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-react'],
                    },
                }
            },
            {
                test: /\.css$/i,
                use: ["style-loader", "css-loader"],
            },
            {
                test: /\.s[ac]ss$/i,
                use: [
                    "style-loader",
                    {
                        loader: "css-loader",
                        options: {
                            sourceMap: true,
                        },
                    },
                    {
                        loader: "sass-loader",
                        options: {
                            sourceMap: true,
                            sassOptions: {
                                outputStyle: "compressed",
                            },
                        },
                    },
                ],
            },
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
            },
            {
                test: /\.(png|jpg|jpeg|gif|ico|eot|ttf|svg|woff|woff2)?$/,
                use: {
                    loader: 'url-loader',
                    options: {
                        limit: false,
                        name: '[name].[ext]'
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
        port: 9002
    },
    devtool: 'inline-source-map',
    resolve: {
        extensions: ['.ts', '.js', '.tsx', '.json'],
        fallback: {
            'assert': require.resolve('assert/'),
            'buffer': require.resolve('buffer/'),
            'stream': require.resolve('stream-browserify'),
            'http': require.resolve('stream-http'),
            "https": require.resolve("https-browserify"),
            "os": require.resolve("os-browserify/browser"),
            'crypto': require.resolve('crypto-browserify'),
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
        new HtmlWebpackPlugin({
            title: 'Wallet SDK',
            template: './page/index.html'
        }),
        new CopyWebpackPlugin({patterns: [{from: './page/js', to: './js'}]})
    ]
}
