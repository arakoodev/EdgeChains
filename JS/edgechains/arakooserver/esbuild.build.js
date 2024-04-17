const esbuild = require("esbuild");
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

const outputDir = path.resolve(__dirname, "dist");

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
}

const distPath = path.join(process.cwd(), "dist");

fs.promises.mkdir(distPath, { recursive: true });

esbuild
    .build({
        entryPoints: ["./index.ts"],
        bundle: true,
        minify: true,
        platform: "node",
        outdir: "./dist",
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
        format: "cjs",
        loader: {
            ".html": "text",
            ".css": "css",
            ".jsonnet": "text",
        },
    })
    .then(() => {
        const entryPoint = path.resolve(process.cwd(), "index.ts");
        const output = path.resolve(process.cwd(), "dist/index.d.ts");

        execSync(`dts-bundle-generator ${entryPoint} --out-file ${output}`, {
            stdio: "inherit",
        });

        console.log("TypeScript compilation and index.d.ts generation successful.");

    })
    .catch(() => {
        console.error("TypeScript compilation or index.d.ts generation failed.");
        process.exit(1);
    });
