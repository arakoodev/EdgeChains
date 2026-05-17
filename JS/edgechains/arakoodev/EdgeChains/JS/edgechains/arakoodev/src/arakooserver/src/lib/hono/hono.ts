// src/arakooServer.ts
// import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { ClaudeTokenizer } from "../../../../ai/src/lib/claude/tokenizer";

export class ArakooServer {
    app: Hono;

    constructor() {
        this.app = new Hono();
        this.setupRoutes();
    }

    private setupRoutes() {
        this.app.post("/v1/messages/count_tokens", async (c) => {
            try {
                const body = await c.req.json();
                
                // Anthropic API expects 'model' and 'messages' (array of {role, content})
                // or 'system' prompt.
                if (!body.model || !body.messages) {
                    return c.json({ error: "Missing required fields: 'model' and 'messages' are required." }, 400);
                }

                let totalTokens = 0;

                // Count tokens in system prompt if provided
                if (body.system && typeof body.system === 'string') {
                    totalTokens += ClaudeTokenizer.countTokens(body.system);
                }

                // Count tokens in messages array
                if (Array.isArray(body.messages)) {
                    for (const msg of body.messages) {
                        if (msg.content && typeof msg.content === 'string') {
                            totalTokens += ClaudeTokenizer.countTokens(msg.content);
                        }
                    }
                }

                return c.json({
                    input_tokens: totalTokens
                });
            } catch (e) {
                return c.json({ error: "Invalid request body" }, 400);
            }
        });
    }

    useCors(allowedEndpoints?: string, options?: any) {
        this.app.use(allowedEndpoints || "*", cors(options));
    }

    createApp(): Hono {
        return this.app;
    }

    listen(port: number) {
        const portNumber = port || 3000;
        if (process.env.arakoo) {
            this.app.fire();
        } else {
            import("@hono/node-server").then((module) => {
                module.serve(
                    {
                        fetch: this.app.fetch,
                        port: portNumber,
                    },
                    () => {
                        console.log(`Server running on port ${portNumber}`);
                    }
                );
            });
        }
    }
}
