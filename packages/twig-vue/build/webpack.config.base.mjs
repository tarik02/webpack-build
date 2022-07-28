import FriendlyErrorsPlugin from '@soda/friendly-errors-webpack-plugin';
import IgnoreEmitPlugin from 'ignore-emit-webpack-plugin';
import ImageMinimizerPlugin from 'image-minimizer-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import * as Path from 'node:path';
import TailwindJitPlugin from 'tailwind-runtime-jit/webpack';
import UnpluginVueComponents from 'unplugin-vue-components/webpack';
import { VueLoaderPlugin } from 'vue-loader';
import Webpack from 'webpack';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import WebpackNotifierPlugin from 'webpack-notifier';

import babelConfig from './babel.config.mjs';
import postcssConfig from './postcss.config.mjs';

/**
 * @param {object} env
 * @param {string} context
 * @param {'src' | 'pub'} type
 * @param {'development' | 'production'} mode
 * @return {Promise<Webpack.Configuration>}
 */
export const buildConfig = async (env, context, type, mode) => {
    /** @type {Webpack.Configuration} */
    const config = {
        mode,
        context,
        output: {
            path: Path.join(context, `dist/${ type }`)
        },
        module: {
            rules: [
                {
                    test: /\.[jt]s$/i,
                    loader: 'babel-loader',
                    exclude: [ /node_modules/ ],
                    options: babelConfig
                },
                {
                    test: /\.vue$/i,
                    loader: 'vue-loader',
                    options: {
                        loaders: {
                            js: [
                                {
                                    loader: 'babel-loader',
                                    options: babelConfig
                                }
                            ],
                            ts: [
                                {
                                    loader: 'babel-loader',
                                    options: babelConfig
                                }
                            ]
                        }
                    }
                },
                {
                    test: /\.s[ac]ss$/i,
                    use: [
                        {
                            development: 'style-loader',
                            production: MiniCssExtractPlugin.loader
                        }[mode],
                        'css-loader',
                        {
                            loader: 'postcss-loader',
                            options: {
                                postcssOptions: postcssConfig
                            }
                        },
                        'sass-loader'
                    ]
                },
                {
                    test: /\.json$/,
                    type: 'asset/resource',
                    generator: {
                        filename: {
                            development: `[name].[id][ext]`,
                            production: `[name].[id][hash:10][ext]`
                        }[mode]
                    }
                },
                {
                    test: /\.(svg|jpe?g|png|gif|webp)$/i,
                    type: 'asset/resource',
                    generator: {
                        filename: {
                            development: '[path][name][ext]',
                            production: '[path][name].[hash:10][ext]'
                        }[mode]
                    }
                },
                {
                    test: /\.(woff2?|ttf)$/i,
                    type: 'asset/resource',
                    generator: {
                        filename: {
                            development: '[path][name][ext]',
                            production: '[path][name].[hash:10][ext]'
                        }[mode]
                    }
                }
            ]
        },
        resolve: {
            extensions: [ '.js', '.ts', '.json', '.vue' ],
            alias: {
                '@src': Path.join(context, '.'),
                '@img': Path.join(context, './img'),
                '@': Path.join(context, `./js-${ type }`),
                '@store': Path.join(context, `./js-${ type }/store`),
                '@plugins': Path.join(context, `./js-${ type }/plugins`),
                '@components': Path.join(context, `./js-${ type }/components`),
                '@constants': Path.join(context, `./js-${ type }/constants`),
                '@routes': Path.join(context, `./js-${ type }/routes`),
                '@helpers': Path.join(context, `./js-${ type }/helpers`),
                '@modules': Path.join(context, `./js-${ type }/modules`),
                '@mixins': Path.join(context, `./js-${ type }/mixins`),
                '@utils': Path.join(context, `./js-${ type }/utils`),
                '@vendor': Path.join(context, `./js-${ type }/vendor`)
            }
        },
        plugins: [
            new Webpack.ProgressPlugin,
            new FriendlyErrorsPlugin,
            ...{
                development: [
                    new TailwindJitPlugin
                ],
                production: [
                    new MiniCssExtractPlugin({
                        filename: ({ chunk }) => ({
                            'pub-production': `${ chunk.name }.${ chunk.hash.substring(0, 10) }.css`
                        }[`${ type }-${ mode }`] ?? `${ chunk.name }.css`)
                    }),
                    new IgnoreEmitPlugin(/css\/[^\/]+\.js$/)
                ]
            }[mode],
            new WebpackNotifierPlugin({
                alwaysNotify: true
            }),
            new VueLoaderPlugin(),
            UnpluginVueComponents({
                dts: true,
                dirs: [
                    Path.join(context, `./js-${ type }/components`)
                ]
            }),
            ...env.analyze ? [new BundleAnalyzerPlugin()] : []
        ],
        // cache: {
        //     type: 'filesystem'
        // },
        optimization: {
            emitOnErrors: true,
            minimizer: [
                '...'
            ]
        }
    };

    if (mode === 'production') {
        config.optimization.minimizer.push(
            new ImageMinimizerPlugin({
                minimizer: {
                    implementation: ImageMinimizerPlugin.imageminMinify,
                    options: {
                        plugins: [
                            'imagemin-gifsicle',
                            'imagemin-mozjpeg',
                            'imagemin-pngquant',
                            ['imagemin-svgo', {
                                plugins: [
                                    'preset-default',
                                    {
                                        name: 'collapseGroups',
                                        active: false
                                    },
                                    {
                                        name: 'removeHiddenElems',
                                        active: false
                                    }
                                ]
                            }]
                        ]
                    }
                }
            })
        );
    }

    if (mode === 'development') {
        config.performance = {
            hints: false
        };
        config.devtool = 'inline-source-map';
    }

    return config;
};