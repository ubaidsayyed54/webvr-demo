var CheckerPlugin = require('awesome-typescript-loader').CheckerPlugin;
var CleanWebpackPlugin = require('clean-webpack-plugin');
var HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: './src/index.ts',
  devtool: 'source-map',
  output: {
    filename: 'bundle.js',
    path: './dist'
  },
  resolve: {
    extensions: ['', '.webpack.js', '.web.js', '.ts', '.tsx', '.js'],
    root: './src'
  },
  module: {
    loaders: [
      {
        test: /\.(jpe?g|png|gif|svg)$/,
        loaders: [
          'file?hash=sha512&digest=hex&name=[hash].[ext]',
          'image-webpack?bypassOnDebug&optimizationLevel=7&interlaced=false'
        ]
      },
      {
        test: /\.tsx?$/,
        loader: 'awesome-typescript-loader'
      },
    ]
  },
  plugins: [
    new CleanWebpackPlugin(['dist']),
    new CheckerPlugin(),
    new HtmlWebpackPlugin({
      template: 'index.html'
    })
  ]
}