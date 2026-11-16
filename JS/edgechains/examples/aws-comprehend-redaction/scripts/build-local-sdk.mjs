import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const exampleRoot = resolve(scriptDir, "..");
const packageRoot = resolve(exampleRoot, "../../arakoodev");
const sourceRoot = resolve(packageRoot, "src/ai");
const outputRoot = resolve(packageRoot, "dist/ai");
const tsc = resolve(exampleRoot, "node_modules/typescript/bin/tsc");

const entrypoint = resolve(sourceRoot, "src/lib/aws-comprehend/index.ts");
const generatedDir = resolve(outputRoot, "src/lib/aws-comprehend");

if (!existsSync(tsc)) {
    throw new Error("TypeScript is not installed. Run npm install in this example first.");
}

rmSync(generatedDir, { recursive: true, force: true });

execFileSync(
    process.execPath,
    [
        tsc,
        "--outDir",
        outputRoot,
        "--rootDir",
        sourceRoot,
        "--target",
        "ES2022",
        "--module",
        "NodeNext",
        "--moduleResolution",
        "NodeNext",
        "--strict",
        "--skipLibCheck",
        "--esModuleInterop",
        "--declaration",
        "--types",
        "node",
        entrypoint,
    ],
    { stdio: "inherit" },
);
