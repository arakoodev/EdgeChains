import { ArakooServer } from "@arakoodev/edgechains.js/arakooserver";
import Jsonnet from "@arakoodev/jsonnet";
import { createSyncRPC } from "@arakoodev/edgechains.js/sync-rpc";
import path from "path";

const server = new ArakooServer();
const app = server.createApp();
const jsonnet = new Jsonnet();

const _dirname = process.cwd();

// Bridge the TypeScript function to Jsonnet
const palm2Call = createSyncRPC(path.join(_dirname, "./src/lib/generateResponse.cjs"));

// Root route for testing
app.get("/", (c: any) => c.text("EdgeChains PaLM 2 Server is running!"));

app.post("/chat", async (c: any) => {
    console.log("Received POST request to /chat");
    try {
        const body = await c.req.json();
        const { question } = body;
        
        const apiKey = process.env.PALM2_API_KEY || "";
        
        jsonnet.extString("palm2_api_key", apiKey);
        jsonnet.extString("question", question || "What is EdgeChains?");
        jsonnet.javascriptCallback("palm2Call", palm2Call);
        
        console.log("Evaluating Jsonnet template...");
        let response = jsonnet.evaluateFile(path.join(_dirname, "./jsonnet/main.jsonnet"));
        
        return c.json(JSON.parse(response));
    } catch (error: any) {
        console.error("Error in /chat:", error);
        return c.json({ error: error.message }, 500);
    }
});

console.log("Starting server on port 3000...");
server.listen(3000);
