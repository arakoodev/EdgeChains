.PHONY: all
all: build-cli

add:
	@echo "Adding wasm32-wasi target"
	@rustup target add wasm32-wasi

clean-rm: clean-shims
	@rm -rf target/

clean:
	@cargo clean

clean-shims:
	@rm -rf dist/ node_modules/
	
build-arakoo:
	@echo "Building arakoo"
	@cargo build -p serve -r

build-cli: build-engine
	@echo "Building javy cli"
	@CARGO_PROFILE_RELEASE_LTO=off cargo build -p cli -r

build-engine: build-shims
	@echo "Building arakoo engine"
	@cargo build -p arakoo-js-engine --target=wasm32-wasi -r

build-shims: shims-install
	@echo "Building shims"
	@cd JS/wasm/crates/arakoo-core/src/apis/http/shims && npm run build

shims-install:
	@echo "Installing deps of shims"
	@cd JS/wasm/crates/arakoo-core/src/apis/http/shims && npm install

compile: build-example
	./target/release/javy compile JS/wasm/examples/ec-wasmjs-hono/bin/app.js

serve:
	./target/release/arakoo index.wasm

build-example:
	@cd JS/wasm/examples/ec-wasmjs-hono && npm i && npm run build arakoo

clean-example:
	@rm -r JS/wasm/examples/ec-wasmjs-hono/node_modules/ JS/wasm/examples/ec-wasmjs-hono/bin/

build-jsonnet:
	@cd JS/jsonnet && ./build.sh