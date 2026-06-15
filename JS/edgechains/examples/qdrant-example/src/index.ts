import { ArakooServer } from "@arakoodev/edgechains.js/arakooserver";
import { createSyncRPC } from "@arakoodev/edgechains.js/sync-rpc";
import fileURLToPath from "file-uri-to-path";
import path from "path";

const server = new ArakooServer();
const app = server.createApp();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const runQdrant = createSyncRPC(path.join(__dirname, "./lib/qdrantOperations.cjs"));

app.post("/qdrant-demo", async (c: any) => {
    try {
        const { url } = await c.req.json();
        const result = await runQdrant(url || "http://localhost:6333");
        return c.json(result);
    } catch (error) {
        return c.json({ error: String(error) }, 500);
    }
});

server.listen(3000);
