const { optimize } = require("webpack");
const webpack = require("webpack");

let definePlugin = new webpack.DefinePlugin({
    "process.env.arakoo": JSON.stringify(true),
});

console.log("starting build");

const config = {
    entry: "./src/index.js",
    output: {
        path: __dirname + "/bin",
        filename: "webpack.js",
        iife: false,
    },
    mode: "production",
    optimization: {
        minimize: false,
    },
    plugins: [definePlugin],
};

module.exports = config;
