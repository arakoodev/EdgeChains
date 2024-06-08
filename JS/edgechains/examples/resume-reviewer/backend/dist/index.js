import { ArakooServer } from "@arakoodev/edgechains.js/arakooserver";
import Jsonnet from "@arakoodev/jsonnet";
//@ts-ignore
import createClient from "sync-rpc";
import fileURLToPath from "file-uri-to-path";
import path from "path";
import { PdfLoader } from "@arakoodev/edgechains.js/document-loader";
import { PrismaClient } from '@prisma/client';
const server = new ArakooServer();
const prisma = new PrismaClient();
const app = server.createApp();
server.useCors("*");
const jsonnet = new Jsonnet();
const __dirname = fileURLToPath(import.meta.url);
const openAICall = createClient(path.join(__dirname, "../lib/generateResponse.cjs"));
app.post("/upload-resume", async (c) => {
    console.time("time");
    const { file, name, email } = await c.req.parseBody();
    if (!name || !email || !file) {
        return c.json({ error: "Missing required fields" }, 400);
    }
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const loader = new PdfLoader(buffer);
    const docs = await loader.loadPdf();
    jsonnet.extString("resume", JSON.stringify(docs));
    jsonnet.javascriptCallback("openAICall", openAICall);
    let resumeDetails = JSON.parse(jsonnet.evaluateFile(path.join(__dirname, "../../jsonnet/main.jsonnet")));
    try {
        await prisma.user.create({
            data: {
                email,
                name,
                resumeDetails
            },
        });
        console.timeEnd("time");
        return c.json({ success: true, data: "Resume added successfully" });
    }
    catch (error) {
        console.log(error);
        return c.json({ error: "Error adding resume" }, 500);
    }
});
app.get("/get-resume", async (c) => {
    try {
        const resume = await prisma.user.findMany();
        return c.json({ success: true, data: resume });
    }
    catch (error) {
        console.log(error);
        return c.json({ error: "Error fetching resumes" }, 500);
    }
});
server.listen(3000);
