import { build } from "esbuild";

build({
    entryPoints: ["src/index.js"],
    bundle: true,
    minify: true,
    outfile: "bin/[...app].js",
    format: "esm",
    target: "esnext",
    platform: "node",
    external:[
        "arakoo-jsonnet"
    ]
}).catch((error) => {
    console.error(error);
    process.exit(1);
});
