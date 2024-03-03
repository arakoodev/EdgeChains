import Jsonnet from "./src/index.js";

const jsonnet = new Jsonnet();

const json = jsonnet.evaluateFile("./example.jsonnet");
console.log(json); // {"a":1,"b":2}
