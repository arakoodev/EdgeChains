import { build } from "esbuild";
import textReplace from "esbuild-plugin-text-replace";
import fs from "fs";
let runtime = process.argv[2];

// let jsonnetLoadPlugin = {
//     name: "jsonnet-load",
//     setup(build) {
//         build.onLoad({ filter: /\.jsonnet$/ }, async (args) => {
//             let code = await fs.promises.readFile(args.path, "utf-8");
//             return {
//                 contents: code,
//                 loader: "text",
//             };
//         })
//     }
// }

build({
    entryPoints: ["src/index.js", "src/example.jsonnet"],
    // entryPoints: ["src/index.js"],
    bundle: true,
    // minify: true,
    minifySyntax: true,
    // outfile: "bin/app.js",
    outdir: "bin",
    // inject:["shim.js"],
    // define:{
    //     "export":"_export"
    // },
    plugins:[
        textReplace({
            include:/src\/index.js$/,
            pattern:[
                ["export default","_export = "]
            ]
        })
    ],
    format: "esm",
    target: "esnext",
    platform: "node",
    // external: ["arakoo"],
    loader: {
        ".jsonnet": "copy",
    },
    define: {
        "process.env.arakoo": JSON.stringify(runtime === "arakoo"),
    },
}).catch((error) => {
    console.error(error);
    process.exit(1);
});
