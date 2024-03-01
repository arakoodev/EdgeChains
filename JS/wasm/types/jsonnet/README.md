# Jsonnet in Wasm

This project aim to running Jsonnet in Wasm. The code is written in Rust and compiled to Wasm using the `wasm32-unknown-unknown` target. The project is based on the [Jrsonnet](https://github.com/CertainLach/jrsonnet) project, which is a Rust implementation of Jsonnet. The project is still in early stage and have some limited support for Jsonnet.

## Available features

-   [x] Jsonnet Snippet evaluation
-   [x] External variable support
-   [ ] External function support
-   [ ] Jsonnet file evaluation

## Usage

```bash
npm install arakoo-jsonnet
```

```javascript
import Jsonnet from "arakoo-jsonnet";

const jsonnet = new Jsonnet();
let code = `
  local username = std.extVar('name');
  local Person(name='Alice') = {
    name: name,
    welcome: 'Hello ' + name + '!',
  };
  {
    person1: Person(username),
    person2: Person('Bob'),
  }`;
const result = jsonnet.extString("name", "John").evaluateSnippet(code);
console.log(result);
```

### Output

```json
{
    "person1": {
        "name": "John",
        "welcome": "Hello John!"
    },
    "person2": {
        "name": "Bob",
        "welcome": "Hello Bob!"
    }
}
```

## Build

```bash
./build.sh
```
