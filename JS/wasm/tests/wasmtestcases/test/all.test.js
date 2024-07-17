import { expect, test } from "vitest";
import { execSync, exec } from "child_process";
import fs from "node:fs/promises";
import path from "node:path";
import axios from "axios";

test("build.js should create bin/index.js", async () => {
    try {
        execSync(`node build.js`);
        const filePath = path.join(__dirname, "../bin/index.js");

        await fs.access(filePath);
        expect(true).toBe(true);
    } catch (error) {
        expect(error).toBeUndefined();
    }
});

test("should build arakoo-js-engine", async () => {
    try {
        const shimPath = path.resolve(__dirname, "../../../crates/arakoo-core/src/apis/http/shims");
        execSync(`cd ${shimPath} && npm install && npm run build`, { stdio: "inherit" });
        execSync("cargo build -p arakoo-js-engine --target=wasm32-wasi -r");
        const arakooPath = path.join(__dirname, "../../../../../target/release/arakoo-compiler");
        await fs.access(arakooPath);
        expect(true).toBe(true);
    } catch (error) {
        expect(error).toBeUndefined();
    }
}, 1000000);

test("should build arakoo", async () => {
    try {
        execSync("CARGO_PROFILE_RELEASE_LTO=off cargo build -p cli -r");
        execSync("cargo build -p serve -r");
        const arakooPath = path.join(__dirname, "../../../../../target/release/arakoo");
        await fs.access(arakooPath);
        expect(true).toBe(true);
    } catch (error) {
        expect(error).toBeUndefined();
    }
}, 1000000);

test("should be create a index.wasm file", async () => {
    try {
        const arakooPath = path.resolve(__dirname, "../../../../../target/release/arakoo-compiler");
        const indexFile = path.resolve(__dirname, "../bin/index.js");
        const filePath = path.join(__dirname, "../index.wasm");
        execSync(`${arakooPath} ${indexFile}`);
        await fs.access(filePath);
        expect(true).toBe(true);
    } catch (error) {
        expect(error).toBeUndefined();
    }
});

test("should start server", async () => {
    const arakooPath = path.resolve(__dirname, "../../../../../target/release/arakoo");
    const indexFile = path.resolve(__dirname, "../index.wasm");

    console.log(arakooPath, indexFile);

    exec(`nohup ${arakooPath} ${indexFile} >> app.log 2>&1 &`);

    await new Promise((resolve) => setTimeout(resolve, 4000));
});

test("should get the response", async () => {
    const response = await axios.get("http://127.0.0.1:8080/hello");
    expect(response.data).toBe("Hello World");
});
