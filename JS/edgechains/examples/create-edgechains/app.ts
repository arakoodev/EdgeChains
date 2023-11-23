import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";

const app = new Hono();

app.route("/");

serve(app, () => {
  console.log("server running on port 3000");
});
