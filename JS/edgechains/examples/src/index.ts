import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import DatabaseConnection from "./config/db";
import HydeSearch from "./routes/hydeSearch.route";

DatabaseConnection.establishDatabaseConnection();

const app = new Hono();

export { HydeSearchService } from './service/HydeSearchService';

app.route("/", HydeSearch);

serve(app, () => {
  console.log("server running on port 3000");
});
