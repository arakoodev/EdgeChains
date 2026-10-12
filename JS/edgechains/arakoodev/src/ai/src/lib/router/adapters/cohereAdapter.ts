import axios from "axios";
import {
    ProviderAdapter,
    ProviderName,
    RouterMessage,
    RouterRequest,
    RouterResponse,
} from "../types.js";

const COHERE_CHAT_URL = "https://api.cohere.ai/v1/chat";

/**
 * Adapter for Cohere's Chat API (v1).
 *
 * The Cohere chat endpoint expects a single ``message`` (the most recent
 * user turn), a ``preamble`` (system prompt), and a ``chat_history`` of
 * prior turns. We project the router's flat message list onto that
 * shape, taking the trailing user turn as ``message``.
 */
export class CohereAdapter implements ProviderAdapter {
    public readonly name: ProviderName = "cohere";
    private readonly apiKey: string;

    constructor(opts: { apiKey: string }) {
        this.apiKey = opts.apiKey;
    }

    async complete(req: RouterRequest): Promise<RouterResponse> {
        const { preamble, history, message } = toCohereShape(req.messages);

        const body: Record<string, unknown> = {
            model: req.model,
            message,
        };
        if (preamble) body.preamble = preamble;
        if (history.length > 0) body.chat_history = history;
        if (req.temperature !== undefined) body.temperature = req.temperature;
        if (req.max_tokens !== undefined) body.max_tokens = req.max_tokens;

        const response = await axios.post(COHERE_CHAT_URL, body, {
            headers: {
                Authorization: `Bearer ${this.apiKey}`,
                "content-type": "application/json",
            },
        });
        const data = response.data ?? {};

        const content: string = typeof data.text === "string" ? data.text : "";
        // Cohere reports token usage under either ``meta.billed_units`` or
        // ``meta.tokens`` depending on API age; prefer billed_units.
        const meta = data.meta || {};
        const billed = meta.billed_units || {};
        const tokens = meta.tokens || {};

        return {
            content,
            provider: this.name,
            model: req.model,
            usage: {
                input_tokens: billed.input_tokens ?? tokens.input_tokens ?? 0,
                output_tokens: billed.output_tokens ?? tokens.output_tokens ?? 0,
            },
            raw: data,
        };
    }
}

/**
 * Map router messages into Cohere's chat shape. The final user turn
 * (the last user-role message in the list) becomes ``message``; earlier
 * turns go into ``chat_history`` with Cohere-style role names
 * (``USER``/``CHATBOT``). System messages collapse into ``preamble``.
 *
 * If the conversation does not end in a user message, the trailing
 * non-system message is used as ``message`` regardless of role — the
 * Cohere API requires *something* there.
 */
function toCohereShape(messages: RouterMessage[]): {
    preamble: string;
    history: Array<{ role: "USER" | "CHATBOT"; message: string }>;
    message: string;
} {
    const preambleParts: string[] = [];
    const nonSystem: RouterMessage[] = [];
    for (const m of messages) {
        if (m.role === "system") preambleParts.push(m.content);
        else nonSystem.push(m);
    }

    let message = "";
    let endIdx = nonSystem.length;
    for (let i = nonSystem.length - 1; i >= 0; i--) {
        if (nonSystem[i].role === "user") {
            message = nonSystem[i].content;
            endIdx = i;
            break;
        }
    }
    if (!message && nonSystem.length > 0) {
        // No user message found — fall back to the trailing turn.
        message = nonSystem[nonSystem.length - 1].content;
        endIdx = nonSystem.length - 1;
    }

    const history = nonSystem.slice(0, endIdx).map((m) => ({
        role: (m.role === "assistant" ? "CHATBOT" : "USER") as "USER" | "CHATBOT",
        message: m.content,
    }));

    return { preamble: preambleParts.join("\n\n"), history, message };
}
