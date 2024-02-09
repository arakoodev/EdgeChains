import { Hono } from "hono";
import { connect } from "@planetscale/database";
import { html } from "hono/html";
const app = new Hono();
const env = {};
app.get("/", (c) => {
  return c.text("Hello World!");
});

app.get("/vars", async (c) => {
  try {
    const extVars = JSON.stringify({
      var1: "value1",
    });
    const result = await jsonnetExtVars("test-vars.jsonnet", extVars);
    return c.json(JSON.parse(result));
  } catch (error) {
    console.log(JSON.stringify(error));
    c.text(error);
  }
});

app.get("/:username", (c) => {
  const { username } = c.req.param();
  return c.html(
    html`<!doctype html>
      <h1>Hello! ${username}!</h1>`,
  );
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
