const esbuild = require("esbuild");
const path = require("path");
const fs = require("fs");

const outputDir = path.resolve(__dirname, "dist");

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
}

const distPath = path.join(process.cwd(), "dist");

fs.promises.mkdir(distPath, { recursive: true });

esbuild
    .build({
        entryPoints: ["./src/index.ts"],
        bundle: true,
        minify: true,
        platform: "node",
        outfile: "./dist/index.js",
        tsconfig: "./tsconfig.json",
        target: "node21.1.0",
        external: [
            "express",
            "tsx",
            "typescript",
            "typeorm",
            "react",
            "react-dom",
            "pg",
            "jsdom",
            "hono",
            "@hanazuki/node-jsonnet",
            "readline/promises",
        ],
        format: "cjs",
        loader: {
            ".html": "text",
            ".css": "css",
            ".jsonnet": "text",
            ".wasm": "file",
        },
    })
    .catch(() => process.exit(1));
