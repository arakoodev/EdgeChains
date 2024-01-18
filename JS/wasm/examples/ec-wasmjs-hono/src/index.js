import { Hono } from "hono";
import { connect } from "@planetscale/database";
import { parseJsonnet } from "arakoo-jsonnet";

const app = new Hono();

app.get("/", (c) => {
    const geo = c.req.raw.geo;
    return c.text(`Your from ${geo.city}, ${geo.country_name}!`);
});

app.get("/jsonnet", async (c) => {
    const jsonnet = await parseJsonnet("test.jsonnet");
    return c.json(JSON.parse(jsonnet));
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

export default app;
