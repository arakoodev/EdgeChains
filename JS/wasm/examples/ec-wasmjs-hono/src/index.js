import { Hono } from "hono"
import { connect } from "@planetscale/database";
import Jsonnet from "@arakoodev/jsonnet";

let jsonnet = new Jsonnet();

const app = new Hono();

function greet() {
    return "Hello from JS";
}

const env = {};

app.get("/hello", (c) => {
    return c.text("Hello World!");
});

app.get("/xtz", async (c) => {
    let result = jsonnet.extString("id", id).javascriptCallback("getAtodo", asyncGetAtodo)
        .evaluateSnippet(`
local todo = std.parseJson(arakoo.native("getAtodo")(std.extVar("id")));
{
result : todo.title
}`);
})

app.get("/async-func/:id", async (c) => {
    let id = c.req.param("id");
    async function asyncGetAtodo(id) {
        try {
            let response = await fetch(`https://jsonplaceholder.typicode.com/todos/${id}`);
            let body = await response.json();
            return JSON.stringify(body);
        } catch (error) {
            console.log("error occured");
            console.log(error);
            return c.json(output);
        }
    }

    let result = jsonnet.extString("id", id).javascriptCallback("getAtodo", asyncGetAtodo)
        .evaluateSnippet(`
    local todo = std.parseJson(arakoo.native("getAtodo")(std.extVar("id")));
  {
    result : todo.title
  }`);
    return c.json(JSON.parse(result));
});

app.post("/question", async (c)=>{
    let body = await c.req.json();
    console.log(body);
    return c.json(body);
})

app.get("/add", (c) => {
    function add(arg1, arg2, arg3) {
        console.log("Args recieved: ", arg1, arg2, arg3);
        return arg1 + arg2 + arg3;
    }
    const code = `
  local username = std.extVar('name');
  local Person(name='Alice') = {
    name: name,
    welcome: 'Hello ' + name + '!',
  };
  {
    person1: Person(username),
    person2: Person('Bob'),
    result : arakoo.native("add")(1,2,3)
  }`;
    let result = jsonnet
        .extString("name", "ll")
        .javascriptCallback("add", add)
        .evaluateSnippet(code);
    return c.json(JSON.parse(result));
});

app.get("/file", (c) => {
    try {
        let result = jsonnet
            .extString("extName", "Mohan")
            .evaluateFile(
                "/home/afshan/EdgeChains/JS/wasm/examples/ec-wasmjs-hono/src/example.jsonnet"
            );
        return c.json(JSON.parse(result));
    } catch (error) {
        console.log("Error occured");
        console.log(error);
        return c.json("Unable to evaluate File");
    }
});

app.get("/:username", (c) => {
    const { username } = c.req.param();
    // redirect to /hello/:username
    return c.redirect(`/hello/${username}`);
});

app.get("/hello/:name", async (c) => {
    const name = c.req.param("name");
    return c.text(`Async Hello ${name}!`);
});

app.get("/env/:key", async (c) => {
    const key = c.req.param("key");
    return c.text(env[key]);
});

const config = {
    host: env["PLANETSCALE_HOST"],
    username: env["PLANETSCALE_USERNAME"],
    password: env["PLANETSCALE_PASSWORD"],
};
const conn = connect(config);

app.get("/db", async (c) => {
    const result = await conn.execute("SHOW TABLES");

    return c.json(result);
});

app.notFound((c) => {
    return c.text("404 not found", 404);
});

app.fire();
// // globalThis._export = app;
