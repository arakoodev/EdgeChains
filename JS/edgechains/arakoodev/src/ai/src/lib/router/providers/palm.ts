import { AxiosInstance } from "axios";
import { ChatRequest, ChatResponse, Deployment, StreamChunk, Usage } from "../types.js";

// Google PaLM "generative language" v1beta2 generateText endpoint. The API was
// deprecated in favor of Gemini, but #286 explicitly names it so we keep the
// shape that matches the historical PaLM REST contract.
const BASE = "https://generativelanguage.googleapis.com/v1beta2";

function endpoint(model: string) {
    // Allow callers to pass either "models/text-bison-001" or "text-bison-001".
    const m = model.startsWith("models/") ? model : `models/${model}`;
    return `${BASE}/${m}:generateText`;
}

function buildBody(req: ChatRequest) {
    const text = req.prompt ?? (req.messages ?? []).map((m) => `${m.role}: ${m.content}`).join("\n");
    return {
        prompt: { text },
        temperature: req.temperature ?? 0.7,
        maxOutputTokens: req.max_tokens ?? 256,
    };
}

function approxTokens(s: string): number {
    if (!s) return 0;
    return Math.max(1, Math.ceil(s.length / 4));
}

export async function palmChat(
    http: AxiosInstance,
    deployment: Deployment,
    req: ChatRequest
): Promise<ChatResponse> {
    const url = `${endpoint(deployment.model)}?key=${encodeURIComponent(deployment.api_key)}`;
    const body = buildBody(req);
    const resp = await http.post(url, body, {
        headers: { "Content-Type": "application/json" },
        timeout: deployment.timeout_ms,
    });
    const data = resp.data;
    const content: string = data?.candidates?.[0]?.output ?? "";

    // PaLM doesn't return usage on generateText; estimate from prompt + output.
    const promptText = body.prompt.text;
    const usage: Usage = {
        prompt_tokens: approxTokens(promptText),
        completion_tokens: approxTokens(content),
        total_tokens: approxTokens(promptText) + approxTokens(content),
    };

    return {
        content,
        usage,
        deployment_id: deployment.id!,
        provider: deployment.provider,
        model: deployment.model,
    };
}

export async function* palmStream(
    http: AxiosInstance,
    deployment: Deployment,
    req: ChatRequest
): AsyncGenerator<StreamChunk> {
    // PaLM generateText doesn't natively stream. We yield the full response as
    // one chunk so callers using { stream: true } still get an AsyncIterable.
    const full = await palmChat(http, deployment, req);
    yield {
        delta: full.content,
        done: false,
        deployment_id: deployment.id!,
        provider: deployment.provider,
        model: deployment.model,
    };
    yield {
        delta: "",
        done: true,
        usage: full.usage,
        deployment_id: deployment.id!,
        provider: deployment.provider,
        model: deployment.model,
    };
}
