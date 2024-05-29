import { build } from "esbuild";

// Build for index.js
build({
    entryPoints: ["index.js"],
    bundle: true,
    outfile: "dist/index.js",
    format: "esm",
    target: "esnext",
    platform: "node",
    treeShaking: false,
}).catch((error) => {
    console.error(error);
    process.exit(1);
});
