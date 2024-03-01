const isArakoo = process.env.arakoo;

let Jsonnet;

if (!isArakoo) {
    let module = import("./jsonnet_wasm.js");
    let {
        jsonnet_evaluate_snippet,
        jsonnet_destroy,
        jsonnet_make,
        ext_string,
        jsonnet_evaluate_file,
    } = await module;
    Jsonnet = class Jsonnet {
        constructor() {
            this.vm = jsonnet_make();
        }

        evaluateSnippet(snippet) {
            return jsonnet_evaluate_snippet(this.vm, "snippet", snippet);
        }

        extString(key, value) {
            ext_string(this.vm, key, value);
            return this;
        }

        evaluateFile(filename) {
            return jsonnet_evaluate_file(this.vm, filename);
        }

        destroy() {
            jsonnet_destroy(this.vm);
        }
    };
} else {
    Jsonnet = class Jsonnet {
        constructor() {
            this.vars = {};
        }

        extString(key, value) {
            this.vars[key] = value;
            return this;
        }
        evaluateSnippet(snippet) {
            let vars = JSON.stringify(this.vars);
            return __jsonnet_evaluate_snippet(vars, snippet);
        }

        destroy() {}
    };
}

export default Jsonnet;
