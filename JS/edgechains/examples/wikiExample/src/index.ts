import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { WikiRouter } from "./WikiExample";

const app = new Hono();

app.route("/",WikiRouter)

serve(app, () => {
    console.log("server running on port 3000");
});
