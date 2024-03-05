import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { ReactChainRouter } from "./ReactChain.js";
import { Palm2Router } from "./Palm2.js";

const app = new Hono();

app.route("/", ReactChainRouter);

app.route('/palm2', Palm2Router)

serve(app, () => {
    console.log("server running on port 3000");
});
