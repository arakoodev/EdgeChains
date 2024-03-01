import { build } from "esbuild";
import { resolve, join } from "path";
import { existsSync, mkdirSync, promises } from "fs";

import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const outputDir = resolve(__dirname, "dist");

if (!existsSync(outputDir)) {
    mkdirSync(outputDir);
}

const distPath = join(process.cwd(), "dist");

promises.mkdir(distPath, { recursive: true });

build({
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
        "@arakoodev/jsonnet",
        "readline/promises",
    ],
    format: "esm",
    loader: {
        ".html": "text",
        ".css": "css",
        ".jsonnet": "text",
        ".wasm": "file",
    },
}).catch(() => process.exit(1));
