const { Jsonnet } = require("@hanazuki/node-jsonnet");
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
