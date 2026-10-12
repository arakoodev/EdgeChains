import axios from "axios";
import {
    ProviderAdapter,
    ProviderName,
    RouterMessage,
    RouterRequest,
    RouterResponse,
} from "../types.js";

const GOOGLE_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Adapter for Google's Generative Language API (Gemini).
 *
 * Gemini's request schema is markedly different from OpenAI's:
 *
 *   - URL is ``{base}/{model}:generateContent``.
 *   - ``system`` is sent as a separate ``systemInstruction`` field.
 *   - ``assistant`` is named ``model`` in Gemini-land.
 *   - Sampling parameters live under a ``generationConfig`` object.
 */
export class GoogleAdapter implements ProviderAdapter {
    public readonly name: ProviderName = "google";
    private readonly apiKey: string;

    constructor(opts: { apiKey: string }) {
        this.apiKey = opts.apiKey;
    }

    async complete(req: RouterRequest): Promise<RouterResponse> {
        const modelPath = req.model.startsWith("models/")
            ? req.model.slice("models/".length)
            : req.model;
        const url = `${GOOGLE_BASE}/${encodeURIComponent(modelPath)}:generateContent`;

        const { systemInstruction, contents } = toGeminiContents(req.messages);

        const generationConfig: Record<string, unknown> = {};
        if (req.temperature !== undefined) generationConfig.temperature = req.temperature;
        if (req.max_tokens !== undefined) generationConfig.maxOutputTokens = req.max_tokens;

        const body: Record<string, unknown> = { contents };
        if (systemInstruction) body.systemInstruction = systemInstruction;
        if (Object.keys(generationConfig).length > 0) body.generationConfig = generationConfig;

        const response = await axios.post(url, body, {
            headers: {
                "content-type": "application/json",
                "x-goog-api-key": this.apiKey,
            },
        });
        const data = response.data ?? {};

        const firstCandidate = data.candidates && data.candidates[0];
        const parts =
            (firstCandidate && firstCandidate.content && firstCandidate.content.parts) || [];
        const content: string = parts
            .filter((p: any) => p && typeof p.text === "string")
            .map((p: any) => p.text)
            .join("");

        const meta = data.usageMetadata || {};
        return {
            content,
            provider: this.name,
            model: req.model,
            usage: {
                input_tokens: meta.promptTokenCount ?? 0,
                output_tokens: meta.candidatesTokenCount ?? 0,
            },
            raw: data,
        };
    }
}

/**
 * Convert router-style messages into Gemini's ``contents`` array and
 * extract any system instructions into a separate field. Roles are
 * mapped ``assistant`` -> ``model`` (Gemini's naming), ``user`` stays as
 * ``user``. System messages are pulled out entirely.
 */
function toGeminiContents(messages: RouterMessage[]): {
    systemInstruction?: { parts: Array<{ text: string }> };
    contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }>;
} {
    const systemParts: Array<{ text: string }> = [];
    const contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];

    for (const m of messages) {
        if (m.role === "system") {
            systemParts.push({ text: m.content });
            continue;
        }
        const role: "user" | "model" = m.role === "assistant" ? "model" : "user";
        contents.push({ role, parts: [{ text: m.content }] });
    }

    return {
        systemInstruction: systemParts.length > 0 ? { parts: systemParts } : undefined,
        contents,
    };
}
