# Jsonnet in Wasm

This project aim to running Jsonnet in Wasm. The code is written in Rust and compiled to Wasm using the `wasm32-unknown-unknown` target. The project is based on the [Jrsonnet](https://github.com/CertainLach/jrsonnet) project, which is a Rust implementation of Jsonnet. The project is still in early stage and have some limited support for Jsonnet.

## Available features

-   [x] Jsonnet Snippet evaluation
-   [x] External variable support
-   [x] External function support
-   [x] Jsonnet file evaluation

## Usage

```bash
npm install arakoo-jsonnet
```
### You can evaluate snippet as follows -

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
### You can evaluate functions directly from jsonnet as follows -

```javascript
  import Jsonnet from "arakoo-jsonnet";

  let jsonnet = new Jsonnet();
  function addSomeNumber(a, b, c) {
    return a+b+c
  }
  let result = jsonnet
  .javascriptCallback("addSomeNumber",addSomeNumber)
  .evaluateSnippet(`{
        result : arakoo.native("addSomeNumber")(3,4,5)
    }`)
```
First you need to register the javascript function you wish to call from jsonnet by calling javascriptCallback method of jsonnet instance . Then you can call the registered function by using arakoo.native method.

### Output
```json
{
  "result": "12"
}
```

> Note - 
>1. You can only return string from the function which you are calling from jsonnet . If you need to return any other type than you can JSON.stringify it and then std.parseJson in jsonnet. 
>2. You need to add  ```--experimental-wasm-modules``` flag while running the js file where you imported / required this jsonnet package

## Build

```bash
./build.sh
```
