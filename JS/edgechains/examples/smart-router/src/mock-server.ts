/**
 * Mock Server for testing the Smart Router without real API keys.
 *
 * Implements a simple Express server that simulates OpenAI, Gemini,
 * and Cohere API endpoints with proper SSE streaming support.
 *
 * FIX: Sends SSE data in incremental chunks instead of a single block,
 * properly simulating real streaming behavior.
 */

import express from "express";

const app = express();
app.use(express.json());

const PORT = 4010;

// ─── OpenAI Mock Endpoint ────────────────────────────────────────

app.post("/v1/chat/completions", (req, res) => {
    const { model, messages, stream, max_tokens } = req.body;
    const lastMessage = messages?.[messages.length - 1]?.content || "Hello";

    if (stream) {
        // FIX: Proper SSE streaming with incremental chunks
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        const responseText = `[Mock OpenAI] Response to: "${lastMessage.substring(0, 50)}..." via ${model}`;
        const words = responseText.split(" ");

        let sentTokens = 0;

        // Send words one at a time with small delays to simulate real streaming
        const sendChunk = (index: number) => {
            if (index >= words.length) {
                // Send the [DONE] event
                res.write("data: [DONE]\n\n");
                res.end();
                return;
            }

            const chunk = {
                id: "chatcmpl-mock",
                object: "chat.completion.chunk",
                created: Date.now(),
                model: model || "gpt-4o",
                choices: [
                    {
                        index: 0,
                        delta: { content: words[index] + (index < words.length - 1 ? " " : "") },
                        finish_reason: null,
                    },
                ],
            };

            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
            sentTokens++;

            // Simulate network latency between chunks
            setTimeout(() => sendChunk(index + 1), 20);
        };

        // Start streaming after a small initial delay
        setTimeout(() => sendChunk(0), 10);
    } else {
        // Non-streaming response
        res.json({
            id: "chatcmpl-mock",
            object: "chat.completion",
            created: Date.now(),
            model: model || "gpt-4o",
            choices: [
                {
                    index: 0,
                    message: {
                        role: "assistant",
                        content: `[Mock OpenAI] Response to: "${lastMessage.substring(0, 50)}..." via ${model}`,
                    },
                    finish_reason: "stop",
                },
            ],
            usage: {
                prompt_tokens: 15,
                completion_tokens: 20,
                total_tokens: 35,
            },
        });
    }
});

// ─── Gemini Mock Endpoint ────────────────────────────────────────

app.post("/v1/models/:model:generateContent", (req, res) => {
    const model = req.params.model;
    const contents = req.body.contents;
    const lastContent = contents?.[contents.length - 1]?.parts?.[0]?.text || "Hello";

    res.json({
        candidates: [
            {
                content: {
                    parts: [{ text: `[Mock Gemini] Response to: "${lastContent.substring(0, 50)}..." via ${model}` }],
                    role: "model",
                },
                finishReason: "STOP",
                index: 0,
            },
        ],
        usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 15,
            totalTokenCount: 25,
        },
    });
});

app.post("/v1/models/:model:streamGenerateContent", (req, res) => {
    const model = req.params.model;
    const contents = req.body.contents;
    const lastContent = contents?.[contents.length - 1]?.parts?.[0]?.text || "Hello";

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");

    const responseText = `[Mock Gemini Stream] Response to: "${lastContent.substring(0, 50)}..." via ${model}`;

    // FIX: Stream incrementally instead of all at once
    const words = responseText.split(" ");
    let index = 0;

    const sendChunk = () => {
        if (index >= words.length) {
            res.end();
            return;
        }

        const chunk = {
            candidates: [
                {
                    content: {
                        parts: [{ text: words[index] + (index < words.length - 1 ? " " : "") }],
                        role: "model",
                    },
                    finishReason: index === words.length - 1 ? "STOP" : undefined,
                },
            ],
            usageMetadata: index === words.length - 1 ? {
                promptTokenCount: 10,
                candidatesTokenCount: 15,
                totalTokenCount: 25,
            } : undefined,
        };

        res.write(JSON.stringify(chunk) + "\n");
        index++;
        setTimeout(sendChunk, 20);
    };

    setTimeout(sendChunk, 10);
});

// ─── Cohere Mock Endpoint ────────────────────────────────────────

app.post("/v2/chat", (req, res) => {
    const { model, messages, stream } = req.body;
    const lastMessage = messages?.[messages.length - 1]?.content || "Hello";

    if (stream) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");

        const responseText = `[Mock Cohere] Response to: "${lastMessage.substring(0, 50)}..." via ${model}`;
        const words = responseText.split(" ");
        let index = 0;

        const sendChunk = () => {
            if (index >= words.length) {
                // Send message-end event
                const endEvent = {
                    type: "message-end",
                    delta: {
                        finish_reason: "stop",
                        usage: { tokens: { input_tokens: 10, output_tokens: 12 } },
                    },
                };
                res.write(`data: ${JSON.stringify(endEvent)}\n\n`);
                res.end();
                return;
            }

            const contentEvent = {
                type: "content-delta",
                delta: {
                    message: {
                        content: { text: words[index] + (index < words.length - 1 ? " " : "") },
                    },
                },
            };

            res.write(`data: ${JSON.stringify(contentEvent)}\n\n`);
            index++;
            setTimeout(sendChunk, 20);
        };

        setTimeout(sendChunk, 10);
    } else {
        res.json({
            id: "chat-mock",
            model: model || "command-r",
            message: {
                role: "assistant",
                content: [{ type: "text", text: `[Mock Cohere] Response to: "${lastMessage.substring(0, 50)}..." via ${model}` }],
            },
            finish_reason: "stop",
            usage: { tokens: { input_tokens: 10, output_tokens: 12 } },
        });
    }
});

// ─── Start Server ────────────────────────────────────────────────

app.listen(PORT, () => {
    console.log(`🚀 Mock LLM Server running on http://localhost:${PORT}`);
    console.log(`   OpenAI:  POST http://localhost:${PORT}/v1/chat/completions`);
    console.log(`   Gemini:  POST http://localhost:${PORT}/v1/models/:model:generateContent`);
    console.log(`   Cohere:  POST http://localhost:${PORT}/v2/chat`);
});
