import {
  jsonnet_evaluate_snippet,
  jsonnet_destroy,
  jsonnet_make,
} from "./jsonnet_wasm.js";

class Jsonnet {
  constructor() {
    this.vm = jsonnet_make();
  }

  evaluateSnippet(snippet) {
    return jsonnet_evaluate_snippet(this.vm, snippet);
  }

  destroy() {
    jsonnet_destroy(this.vm);
  }
}

export default Jsonnet;
