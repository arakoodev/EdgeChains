import axios from "axios";
import {
    ProviderAdapter,
    ProviderName,
    RouterMessage,
    RouterRequest,
    RouterResponse,
} from "../types.js";

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
/**
 * Anthropic requires ``max_tokens`` on every request, so we apply a
 * conservative default when the caller does not specify one.
 */
const DEFAULT_MAX_TOKENS = 1024;

/**
 * Adapter for Anthropic's Messages API.
 *
 * The Anthropic API differs from OpenAI in two notable ways that this
 * adapter normalizes away:
 *
 *   1. ``system`` is a top-level field, not a message role. Any messages
 *      with ``role: "system"`` are collapsed into a single ``system`` string.
 *   2. ``max_tokens`` is required; we fall back to {@link DEFAULT_MAX_TOKENS}.
 */
export class AnthropicAdapter implements ProviderAdapter {
    public readonly name: ProviderName = "anthropic";
    private readonly apiKey: string;

    constructor(opts: { apiKey: string }) {
        this.apiKey = opts.apiKey;
    }

    async complete(req: RouterRequest): Promise<RouterResponse> {
        const { system, messages } = splitSystemMessages(req.messages);

        const body: Record<string, unknown> = {
            model: req.model,
            messages: messages.map((m) => ({
                role: m.role,
                content: m.content,
            })),
            max_tokens: req.max_tokens ?? DEFAULT_MAX_TOKENS,
        };
        if (system) body.system = system;
        if (req.temperature !== undefined) body.temperature = req.temperature;

        const headers: Record<string, string> = {
            "x-api-key": this.apiKey,
            "anthropic-version": ANTHROPIC_VERSION,
            "content-type": "application/json",
        };

        const response = await axios.post(ANTHROPIC_MESSAGES_URL, body, { headers });
        const data = response.data ?? {};

        // Anthropic returns ``content: [{ type: "text", text: "..." }, ...]``.
        // Concatenate every text block; non-text blocks (tool_use, etc.) are
        // surfaced via ``raw`` for advanced consumers.
        const content: string = Array.isArray(data.content)
            ? data.content
                  .filter((blk: any) => blk && blk.type === "text" && typeof blk.text === "string")
                  .map((blk: any) => blk.text)
                  .join("")
            : "";

        const usage = data.usage || {};
        return {
            content,
            provider: this.name,
            model: data.model || req.model,
            usage: {
                input_tokens: usage.input_tokens ?? 0,
                output_tokens: usage.output_tokens ?? 0,
            },
            raw: data,
        };
    }
}

/**
 * Pull ``system`` messages out of the conversation and join them with a
 * blank line. Anthropic expects the remaining messages to alternate
 * between ``user`` and ``assistant``; we leave ordering to the caller.
 */
function splitSystemMessages(messages: RouterMessage[]): {
    system: string;
    messages: RouterMessage[];
} {
    const systemParts: string[] = [];
    const rest: RouterMessage[] = [];
    for (const m of messages) {
        if (m.role === "system") systemParts.push(m.content);
        else rest.push(m);
    }
    return { system: systemParts.join("\n\n"), messages: rest };
}
