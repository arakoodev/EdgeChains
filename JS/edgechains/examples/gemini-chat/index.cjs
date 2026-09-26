const { GeminiAI } = require("@arakoodev/edgechains.js/ai");
const Jsonnet = require("@arakoodev/jsonnet");
const { createChatServer } = require("./app.cjs");

if (!process.env.GEMINI_API_KEY || !process.env.GEMINI_MODEL) {
    console.error("Set GEMINI_API_KEY and GEMINI_MODEL before starting the example.");
    process.exitCode = 1;
} else {
    const server = createChatServer({
        client: new GeminiAI(),
        model: process.env.GEMINI_MODEL,
        Jsonnet,
    });
    server.listen(3000, "127.0.0.1", () => {
        console.log("Gemini chat: http://127.0.0.1:3000/chat");
    });
}
