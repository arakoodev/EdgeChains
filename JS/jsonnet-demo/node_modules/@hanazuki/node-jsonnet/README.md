# node-jsonnet

**@hanazuki/node-jsonnet** is a [libjsonnet](https://jsonnet.org) binding for [Node.js](https://nodejs.org) (native addon), which supports all the basic Jsonnet functionality including `import` and native callbacks (`std.native`). It also comes with TypeScript type definitions.

## Synopsis

```typescript
import { Jsonnet } from "@hanazuki/node-jsonnet";
const jsonnet = new Jsonnet();

// Evaluates a simple Jsonnet program into a JSON value
jsonnet.evaluateSnippet(`{a: 1 + 2, b: self.a * 3}`)
       .then(json => console.log(JSON.parse(json)));  // => { a: 3, b: 9 }

// Jsonnet programs can use JavaScript values through external variables (std.extVar)
// and native callbacks (std.native).
jsonnet.extCode("x", "4")
       .nativeCallback("add", (a, b) => Number(a) + Number(b), "a", "b")
       .evaluateSnippet(`std.extVar("x") * std.native("add")(1, 2)`)
       .then(json => console.log(JSON.parse(json)));  // => 12
```

The library is documented in the TypeScript type definitions at [`types/index.d.ts`](types/index.d.ts), and [HTML documentation](https://hanazuki.github.io/node-jsonnet/) is also available online.

## Installation Requirements

- [Node.js](https://nodejs.org/) v14 or later
- [GCC](https://gcc.gnu.org/projects/cxx-status.html#cxx17) or [Clang](https://clang.llvm.org/cxx_status.html#cxx17) C++ compiler that supports C++17
- CMake 3.8 or later

## License
**@hanazuki/node-jsonnet** is licensed under the MIT License (See [LICENSE](LICENSE) file for the terms). **libjsonnet**, whose source code is bundled in the distributed NPM packages of @hanazuki/node-jsonnet, is licensed under the Apache License, Version 2.0 (See [third_party/jsonnet/LICENSE in this package](third_party/jsonnet/LICENSE) or [LICENSE file in the original repository](https://github.com/google/jsonnet/blob/master/LICENSE)). libjsonnet also bundles third-party software that is subject to other OSS licenses.
