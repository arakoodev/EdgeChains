#!/bin/bash
# Call this script as `./build.sh <remove-older>` eg. `./build.sh false`

set -e

# Remove older build
if [ "$1" != "false" ]; then
	echo "Removing older build..."
	# check if pkg folder exists
	if [ -d "jsonnet" ]; then
		echo "Removing pkg folder..."
		rm -rf jsonnet
	fi
fi
OUT_FOLDER="jsonnet"
OUT_JSON="${OUT_FOLDER}/package.json"
OUT_TARGET="bundler"
OUT_NPM_NAME="arakoo"
WASM_BUILD_PROFILE="release"

echo "Using build profile: \"${WASM_BUILD_PROFILE}\""

# Check if wasm-pack is installed
if ! command -v wasm-pack &>/dev/null; then
	echo "wasm-pack could not be found, installing now..."
	curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
fi

echo "Building query-engine-wasm using $WASM_BUILD_PROFILE profile"
CARGO_PROFILE_RELEASE_OPT_LEVEL="z" wasm-pack build "--$WASM_BUILD_PROFILE" --target $OUT_TARGET --out-name jsonnet_wasm

mv "pkg/" $OUT_FOLDER

sleep 1

enable_cf_in_bindings() {
	# Enable Cloudflare Workers in the generated JS bindings.
	# The generated bindings are compatible with:
	# - Node.js
	# - Cloudflare Workers / Miniflare

	local FILE="$1" # e.g., `query_engine.js`
	local BG_FILE="jsonnet_wasm_bg.js"
	local OUTPUT_FILE="${OUT_FOLDER}/jsonnet_wasm.js"

	cat <<EOF >"$OUTPUT_FILE"
import * as imports from "./${BG_FILE}";

// switch between both syntax for Node.js and for workers (Cloudflare Workers)
import * as wkmod from "./${BG_FILE%.js}.wasm";
import * as nodemod from "./${BG_FILE%.js}.wasm";
if ((typeof process !== 'undefined') && (process.release.name === 'node')) {
    imports.__wbg_set_wasm(nodemod);
} else {
    const instance = new WebAssembly.Instance(wkmod.default, { "./${BG_FILE}": imports });
    imports.__wbg_set_wasm(instance.exports);
}

export * from "./${BG_FILE}";
EOF

	cat <<EOF >"$OUT_FOLDER/index.js"
import Jsonnet from "./jsonnet.js";

export default Jsonnet;
EOF

	cat <<EOF >"$OUT_FOLDER/index.d.ts"
declare class Jsonnet {
    constructor();
    evaluateSnippet(snippet: string): string;
    destroy(): void;
    extString(key: string, value: string): this;
    evaluateFile(filename: string): string;
}

export default Jsonnet;
EOF

}

update_package_json() {
	local FILE="$1" # e.g., `index.js`
	local OUTPUT_FILE="${OUT_FOLDER}/package.json"
	jq '.module = "'${FILE}'"' "${OUT_JSON}" >temp.json
	jq '.types = "'${FILE%.js}.d.ts'"' temp.json >temp2.json
	jq '.files = ["'${FILE}'", "'${FILE%.js}.d.ts'"]' temp2.json >"${OUTPUT_FILE}"
	rm temp.json temp2.json
}

move_jsonnet_to_src() {
	mv jsonnet/*.js jsonnet/*.wasm jsonnet/*.d.ts src/
	rm -rf src/snippets
	mv jsonnet/snippets/ src/
	rm -rf jsonnet
}

enable_cf_in_bindings "jsonnet_wasm_bg.js"
update_package_json "index.js"
move_jsonnet_to_src
