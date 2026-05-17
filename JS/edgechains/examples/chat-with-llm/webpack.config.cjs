const webpack = require("webpack");
const path = require("path");

let definePlugin = new webpack.DefinePlugin({
    "process.env.arakoo": true,
});

let replacePlugin = new webpack.NormalModuleReplacementPlugin(
    /\@arakoodev\/edgechains\.js\/sync-rpc/,
    function (resource) {
        resource.request = path.resolve(__dirname, "empty-module.js");
    }
);

const config = [
    {
        name: "first",
        entry: "./dist/index.js",
        output: {
            path: __dirname + "/dist",
            filename: "index.cjs",
            iife: false,
        },
        resolve: {
            extensions: [".js"],
        },
        mode: "production",
        module: {
            rules: [
                {
                    test: /\.js$/,
                    exclude: /node_modules/,
                    use: path.resolve("replaceloader.cjs"), // Use the custom loader
                },
            ],
        },
        optimization: {
            minimize: false,
        },
        plugins: [definePlugin],
    },
    {
        name: "second",
        entry: "./dist/index.cjs",
        output: {
            path: __dirname + "/dist",
            filename: "final.js",
            iife: false,
        },
        resolve: {
            extensions: [".cjs", ".js"],
        },
        mode: "production",
        module: {
            rules: [
                {
                    test: /\.cjs$/,
                    exclude: /node_modules/,
                    use: path.resolve("replacedirnameloader.cjs"),
                },
            ],
        },
        optimization: {
            minimize: false,
        },
        plugins: [definePlugin],
        dependencies: ["first"],
    },
];

module.exports = config;
