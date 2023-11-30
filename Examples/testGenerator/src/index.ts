import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { HydeSearchRouter } from "./routes/hydeSearch.route.js";
import { view } from "../htmljs.js";
import ExampleLayout from "./layouts/ExampleLayout.js";
import { testGenratorRouter } from "./testGeneration/TestGenerator.js";

const app = new Hono();

app.route("/", HydeSearchRouter);
app.route("/testcase",testGenratorRouter);

app.get("/", view(ExampleLayout));

serve(app, () => {
    console.log("server running on port 3000");
});
