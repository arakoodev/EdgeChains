import { ArakooServer } from "@arakoodev/edgechains.js/arakooserver";
import { AWSComprehendPIIRedactor } from "@arakoodev/edgechains.js/pii-redactor";
import { OpenAI } from "@arakoodev/edgechains.js/ai";

const server = new ArakooServer();

// Initialise the PII redactor (reads AWS creds from .env)
const redactor = new AWSComprehendPIIRedactor();

// Initialise OpenAI endpoint (reads OPENAI_API_KEY from .env)
const openai = new OpenAI({});

export const RedactRouter = server.createApp();

/**
 * GET /redact?text=<user_input>
 *
 * Demonstrates the full chain:
 *   1. User text  →  AWSComprehendPIIRedactor.sanitize()  →  safe prompt
 *   2. Safe prompt  →  OpenAI.chat()  →  AI response (no PII ever sent to OpenAI)
 */
RedactRouter.get("/", async (c: any) => {
    const userText = c.req.query("text");
    if (!userText) {
        return c.json({ error: "Provide a ?text= query parameter" }, 400);
    }

    // ── Step 1: Detect & redact PII ──────────────────────────────────────────
    const redactResult = await redactor.redactPII(userText);

    // ── Step 2: Pass sanitised text to OpenAI ──────────────────────────────
    //    The LLM never sees the original PII — only [NAME], [EMAIL], etc.
    const aiResponse = await openai.chat({
        prompt: `Summarise this request concisely: "${redactResult.redactedText}"`,
        model: "gpt-4o-mini",
    });

    return c.json({
        originalText: userText,
        redactedText: redactResult.redactedText,
        detectedEntities: redactResult.detectedEntities,
        aiSummary: aiResponse.content,
    });
});

/**
 * GET /redact/detect?text=<user_input>
 *
 * Only detect PII — do not send anything to an LLM.
 * Useful for auditing / compliance dashboards.
 */
RedactRouter.get("/detect", async (c: any) => {
    const userText = c.req.query("text");
    if (!userText) {
        return c.json({ error: "Provide a ?text= query parameter" }, 400);
    }

    const entities = await redactor.detectPII(userText);
    return c.json({ text: userText, detectedEntities: entities });
});
