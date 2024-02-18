const isArakoo = process.env.arakoo;

let Jsonnet;

if (!isArakoo) {
  let module = import("./jsonnet_wasm.js");
  let { jsonnet_evaluate_snippet, jsonnet_destroy, jsonnet_make } =
    await module;
  Jsonnet = class Jsonnet {
    constructor() {
      this.vm = jsonnet_make();
    }

    evaluateSnippet(snippet) {
      return jsonnet_evaluate_snippet(this.vm, snippet);
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
    }
    evaluateSnippet(snippet) {
      return __jsonnet_evaluate_snippet("", snippet);
    }

    destroy() {}
  };
}

export default Jsonnet;
