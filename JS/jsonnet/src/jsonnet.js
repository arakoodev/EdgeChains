// const isArakoo = process.env.arakoo;

let Jsonnet;

if (!process.env.arakoo) {
    let module = require("./jsonnet_wasm.js");
    let {
        jsonnet_evaluate_snippet,
        jsonnet_destroy,
        jsonnet_make,
        jsonnet_ext_string,
        jsonnet_evaluate_file,
        get_func,
        set_func,
        register_native_callback,
    } = module;
    Jsonnet = class Jsonnet {
        constructor() {
            this.vm = jsonnet_make();
        }

        evaluateSnippet(snippet) {
            return jsonnet_evaluate_snippet(this.vm, "snippet", snippet);
        }

        extString(key, value) {
            jsonnet_ext_string(this.vm, key, value);
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
        constructor() {}

        #getVm() {
            if (!this.vm) {
                this.vm = __jsonnet_make();
            }
            return this.vm;
        }

        #setFunc(name, func) {
            __jsonnet_func_map[name] = func;
        }

        evaluateSnippet(snippet) {
            let vm = this.#getVm();
            return __jsonnet_evaluate_snippet(vm, snippet);
        }

        extString(key, value) {
            let vm = this.#getVm();
            __jsonnet_ext_string(vm, key, value);
            return this;
        }

        evaluateFile(filename) {
            let vm = this.#getVm();
            return __jsonnet_evaluate_file(vm, filename);
        }

        javascriptCallback(name, func) {
            let numOfArgs = func.length;
            console.debug("Constructor name is: ", func.constructor.name);
            if (func.constructor && func.constructor.name === "AsyncFunction") {
                console.debug("In if part");
                if (numOfArgs > 0) {
                    this.#setFunc(name, async (args) => {
                        console.debug("Args recieved in async function: ", args);
                        let result = await eval(func)(...JSON.parse(args));
                        return result.toString();
                    });
                } else {
                    this.#setFunc(name, async () => {
                        let result = await eval(func)();
                        return result;
                    });
                }
            } else {
                console.debug("In else part");
                if (numOfArgs > 0) {
                    this.#setFunc(name, (args) => {
                        console.debug("Args recieved: ", args);
                        let result = eval(func)(...JSON.parse(args));
                        return result.toString();
                    });
                } else {
                    this.#setFunc(name, () => {
                        let result = eval(func)();
                        return result;
                    });
                }
            }
            __jsonnet_register_func(this.vm, name, numOfArgs);
            return this;
        }

        destroy() {
            let vm = this.#getVm();
            __jsonnet_destroy(vm);
        }
    };
}

module.exports = Jsonnet;
