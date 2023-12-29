import { build } from "esbuild";

// Build for index.js
build({
    entryPoints: ["src/index.js"],
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

// Build for buffer.js
build({
    entryPoints: ["src/buffer.js"],
    bundle: true,
    outfile: "dist/buffer.js",
    format: "esm",
    target: "esnext",
    platform: "node",
    treeShaking: false,
}).catch((error) => {
    console.error(error);
    process.exit(1);
});

build({
    entryPoints: ["src/path.js"],
    bundle: true,
    outfile: "dist/path.js",
    format: "esm",
    target: "esnext",
    platform: "node",
    treeShaking: false,
}).catch((error) => {
    console.error(error);
    process.exit(1);
});

build({
    entryPoints: ["src/crypto.ts"],
    bundle: true,
    outfile: "dist/crypto.js",
    format: "esm",
    target: "esnext",
    platform: "node",
    treeShaking: false,
}).catch((error) => {
    console.error(error);
    process.exit(1);
});

build({
    entryPoints: ["src/arakoo-jsonnet.js"],
    bundle: true,
    outfile: "dist/arakoo-jsonnet.js",
    format: "esm",
    target: "esnext",
    platform: "node",
    treeShaking: false,
}).catch((error) => {
    console.error(error);
    process.exit(1);
});
