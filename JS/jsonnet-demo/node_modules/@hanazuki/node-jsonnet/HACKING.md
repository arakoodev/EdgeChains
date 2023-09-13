# Hacking on node-jsonnet

We welcome all your contributions to node-jsonnet.

## Project files

- lib/ -- JavaScript stub to load native addon
- scripts/ -- Utility scripts for development and testing
- spec/ -- Jasmine specs
- src/ -- Node.js binding to libjsonnet, written in C++
- third_party/
  - jsonnet/ -- vendored libjsonnet (git submodule)
- types/ -- TypeScript type definition

## Development
`npm install` will install dependencies and build native addon. To cleanly rebuild the addon, delete `build/` directory then `npm install`, or run `npm run cmake-verbose`. These build commands generate `compile_commands.json`, which can be consumed by clangd and some IDE's for syntax checking and code completion.

C++ source files should be formatted with clang-format before committed. Files of the other kinds should respect `.editorconfig`.

## Testing
`npm test` will evaluate [Jasmine](https://jasmine.github.io/) specs. `spec/binding_spec.js` describes the behavior of the binding. Using the test suite maintained by the Jsonnet developers, `spec/jsonnet_spec.js` ensures that the binding evaluates Jsonnet programs in the same way as the original jsonnet command.

Test coverage is tracked on [Coveralls](https://coveralls.io/github/hanazuki/node-jsonnet).

## Packaging

Running `scripts/test-packaging.sh` will produce an NPM tarball and check if the package can be cleanly installed.

## Compatibility policies

node-jsonnet should maintain compatibility with:

- Node.js: the latest patch level of every non-EOL'd LTS series
- C++ Compilers:
  - GCC and Clang shipped with:
    - Debian: the two latest major releases (stable and oldstable)
    - Ubuntu: the two latest LTS releases
    - MacOS: the latest release (Clang from Apple and GCC from Homebrew)
- TypeScript: reasonably new versions
