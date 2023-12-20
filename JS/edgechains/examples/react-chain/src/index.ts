import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { ReactChainRouter } from "./ReactChain.js";

const app = new Hono();

app.route("/", ReactChainRouter);


serve(app, () => {
    console.log("server running on port 3000");
});
