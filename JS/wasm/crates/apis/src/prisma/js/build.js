const { build } = require('esbuild')

build({
    entryPoints: ["index.js"],
    bundle: true,
    outfile: "dist/index.js",
    format: "esm",
    platform: "node",
}).catch((error) => {
    console.error(error);
    process.exit(1);
});
