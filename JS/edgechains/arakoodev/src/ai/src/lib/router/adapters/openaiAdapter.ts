import axios from "axios";
import {
    ProviderAdapter,
    ProviderName,
    RouterRequest,
    RouterResponse,
} from "../types.js";

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";

/**
 * Adapter for the OpenAI Chat Completions API.
 *
 * Translates the router's normalized request into OpenAI's wire format
 * and projects the response back into {@link RouterResponse}. Multi-turn
 * messages, system prompts, temperature, and max_tokens are all
 * forwarded verbatim.
 */
export class OpenAIAdapter implements ProviderAdapter {
    public readonly name: ProviderName = "openai";
    private readonly apiKey: string;
    private readonly orgId: string;

    constructor(opts: { apiKey: string; orgId?: string }) {
        this.apiKey = opts.apiKey;
        this.orgId = opts.orgId || process.env.OPENAI_ORG_ID || "";
    }

    async complete(req: RouterRequest): Promise<RouterResponse> {
        const body: Record<string, unknown> = {
            model: req.model,
            messages: req.messages.map((m) => ({
                role: m.role,
                content: m.content,
                ...(m.name ? { name: m.name } : {}),
            })),
        };
        if (req.temperature !== undefined) body.temperature = req.temperature;
        if (req.max_tokens !== undefined) body.max_tokens = req.max_tokens;

        const headers: Record<string, string> = {
            Authorization: `Bearer ${this.apiKey}`,
            "content-type": "application/json",
        };
        if (this.orgId) headers["OpenAI-Organization"] = this.orgId;

        const response = await axios.post(OPENAI_CHAT_URL, body, { headers });
        const data = response.data ?? {};
        const choice = (data.choices && data.choices[0]) || {};
        const content: string = (choice.message && choice.message.content) || "";
        const usage = data.usage || {};

        return {
            content,
            provider: this.name,
            model: data.model || req.model,
            usage: {
                input_tokens: usage.prompt_tokens ?? 0,
                output_tokens: usage.completion_tokens ?? 0,
            },
            raw: data,
        };
    }
}
