import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import DatabaseConnection from "./src/config/db.js";
import { HydeSearchRouter } from "./src/routes/hydeSearch.route.js";

DatabaseConnection.establishDatabaseConnection();

const app = new Hono();

app.route("/", HydeSearchRouter);

serve(app, () => {
    console.log("server running on port 3000");
});
