import * as imports from "./jsonnet_wasm_bg.js";

// switch between both syntax for Node.js and for workers (Cloudflare Workers)
import * as wkmod from "./jsonnet_wasm_bg.wasm";
import * as nodemod from "./jsonnet_wasm_bg.wasm";
if (typeof process !== "undefined" && process.release.name === "node") {
    imports.__wbg_set_wasm(nodemod);
} else {
    const instance = new WebAssembly.Instance(wkmod.default, { "./jsonnet_wasm_bg.js": imports });
    imports.__wbg_set_wasm(instance.exports);
}

export * from "./jsonnet_wasm_bg.js";
