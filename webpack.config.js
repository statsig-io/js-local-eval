const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');
const CircularDependencyPlugin = require('circular-dependency-plugin');
const mangleConfig = require('./mangle.config');

module.exports = {
  entry: './src/index.ts',
  mode: 'production',
  target: 'web',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  output: {
    filename: 'statsig-prod-web-sdk.js',
    library: {
      type: 'umd',
      name: {
        root: 'statsig',
      },
    },
    path: path.resolve(__dirname, 'build'),
    libraryExport: 'default',
    globalObject: 'this',
  },
  plugins: [
    new CircularDependencyPlugin({
      onDetected({ module: _webpackModuleRecord, paths, compilation }) {
        compilation.errors.push(new Error(paths.join(' -> ')));
      },
      exclude: /node_modules/,
      include: /src/,
      failOnError: true,
      allowAsyncCycles: false,
      cwd: process.cwd(),
    }),
  ],
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        minify: TerserPlugin.uglifyJsMinify,
        terserOptions: {
          mangle: {
            properties: {
              reserved: mangleConfig.reserved,
              regex: mangleConfig.regex,
              keep_quoted: true,
            },
          },
        },
      }),
    ],
  },
};
