const { createServer } = require("node:http");
const { readFileSync } = require("node:fs");
const path = require("node:path");

function createChatServer({ client, model, Jsonnet }) {
    const prompt = readFileSync(path.join(__dirname, "jsonnet/chat.jsonnet"), "utf8");
    return createServer(async (request, response) => {
        const send = (status, body) => {
            response.writeHead(status, { "Content-Type": "application/json" });
            response.end(JSON.stringify(body));
        };
        if (request.method !== "POST" || request.url !== "/chat") {
            send(404, { error: "Use POST /chat" });
            return;
        }
        let input;
        try {
            const chunks = [];
            let bytes = 0;
            for await (const chunk of request) {
                bytes += chunk.length;
                if (bytes <= 65536) chunks.push(chunk);
            }
            if (bytes > 65536) {
                send(413, { error: "Question is too large" });
                return;
            }
            input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
            if (typeof input?.question !== "string" || !input.question.trim()) {
                send(400, { error: "question must be a non-empty string" });
                return;
            }
        } catch {
            send(400, { error: "Send a JSON object with a question" });
            return;
        }
        try {
            const jsonnet = new Jsonnet();
            let options;
            try {
                options = JSON.parse(
                    jsonnet
                        .extString("model", model)
                        .extString("question", input.question)
                        .evaluateSnippet(prompt)
                );
            } finally {
                jsonnet.destroy();
            }
            const result = await client.chat(options);
            // Keep promptFeedback and finishReason when Google returns no text.
            send(200, result);
        } catch {
            send(502, { error: "Gemini could not complete the request" });
        }
    });
}

module.exports = { createChatServer };
