node-jsonnet
=============
* This module is a Node.js wrapper for Jsonnet.
* Learn more about Jsonnet here: [https://jsonnet.org/](https://jsonnet.org/)

# Changes from original repository
* Updated Jsonnet Library (Build date: 2019-03-15)
* Updated dependencies
* Moved all dependencies to devDependencies where they belong

# Jsonnet example

before:

```jsonnet
// Jsonnet Example
{
    person1: {
        name: "Alice",
        welcome: "Hello " + self.name + "!",
    },
    person2: self.person1 { name: "Bob" },
}
```

after:

```json
{
   "person1": {
      "name": "Alice",
      "welcome": "Hello Alice!"
   },
   "person2": {
      "name": "Bob",
      "welcome": "Hello Bob!"
   }
}
```



# Usage

```shell
$ npm install @rbicker/jsonnet --save
```

```javascript

const Jsonnet = require('@rbicker/jsonnet');
const fs = require('fs');

const code = fs.readFileSync("./menu.jsonnet");

const jsonnet = new Jsonnet();
// eval jsonnet to json
const result = jsonnet.eval(code);

console.log(result);
```
