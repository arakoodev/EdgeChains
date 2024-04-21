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
        get_func,
        set_func,
        register_native_callback,
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

        javascriptCallback(name, func) {
            let numOfArgs = func.length;
            if (numOfArgs > 0) {
                set_func(name, (args) => {
                    let result = eval(func)(...JSON.parse(args));
                    return result.toString();
                });
            } else {
                set_func(name, () => {
                    let result = eval(func)();
                    return result;
                });
            }
            register_native_callback(this.vm, name, numOfArgs);
            return this;
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
        evaluateFile(filename) {
            let vars = JSON.stringify(this.vars);
            return __jsonnet_evaluate_file(vars, filename);
        }

        destroy() {}
    };
}

export default Jsonnet;
