import { AxiosInstance } from "axios";
import { ChatRequest, ChatResponse, Deployment, StreamChunk, Usage } from "../types.js";
import { parseSSE } from "../sse.js";

const CHAT_URL = "https://api.openai.com/v1/chat/completions";

function buildBody(req: ChatRequest, deployment: Deployment, stream: boolean) {
    const messages =
        req.messages ??
        (req.prompt ? [{ role: "user" as const, content: req.prompt }] : []);
    return {
        model: deployment.model,
        messages,
        max_tokens: req.max_tokens ?? 256,
        temperature: req.temperature ?? 0.7,
        stream,
    };
}

function headers(deployment: Deployment) {
    return {
        Authorization: `Bearer ${deployment.api_key}`,
        "Content-Type": "application/json",
    };
}

export async function openaiChat(
    http: AxiosInstance,
    deployment: Deployment,
    req: ChatRequest
): Promise<ChatResponse> {
    const resp = await http.post(CHAT_URL, buildBody(req, deployment, false), {
        headers: headers(deployment),
        timeout: deployment.timeout_ms,
    });
    const data = resp.data;
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    const u = data?.usage ?? {};
    const usage: Usage = {
        prompt_tokens: u.prompt_tokens ?? 0,
        completion_tokens: u.completion_tokens ?? 0,
        total_tokens: u.total_tokens ?? (u.prompt_tokens ?? 0) + (u.completion_tokens ?? 0),
    };
    return {
        content,
        usage,
        deployment_id: deployment.id!,
        provider: deployment.provider,
        model: deployment.model,
    };
}

export async function* openaiStream(
    http: AxiosInstance,
    deployment: Deployment,
    req: ChatRequest
): AsyncGenerator<StreamChunk> {
    const resp = await http.post(CHAT_URL, buildBody(req, deployment, true), {
        headers: headers(deployment),
        timeout: deployment.timeout_ms,
        responseType: "stream",
    });

    let prompt_tokens = 0;
    let completion_tokens = 0;
    let lastChunk: StreamChunk | null = null;

    for await (const event of parseSSE(resp.data)) {
        if (!event.data || event.data === "[DONE]") continue;
        let json: any;
        try {
            json = JSON.parse(event.data);
        } catch {
            continue;
        }
        const delta: string = json?.choices?.[0]?.delta?.content ?? "";
        if (json?.usage) {
            prompt_tokens = json.usage.prompt_tokens ?? prompt_tokens;
            completion_tokens = json.usage.completion_tokens ?? completion_tokens;
        }
        if (delta) {
            // Rough completion-token estimate when usage isn't streamed back
            // (OpenAI only sends usage when stream_options.include_usage is set).
            completion_tokens += estimateTokens(delta);
            const chunk: StreamChunk = {
                delta,
                done: false,
                deployment_id: deployment.id!,
                provider: deployment.provider,
                model: deployment.model,
            };
            lastChunk = chunk;
            yield chunk;
        }
    }

    yield {
        delta: "",
        done: true,
        usage: {
            prompt_tokens,
            completion_tokens,
            total_tokens: prompt_tokens + completion_tokens,
        },
        deployment_id: deployment.id!,
        provider: deployment.provider,
        model: deployment.model,
    };
    void lastChunk;
}

function estimateTokens(s: string): number {
    // Cheap heuristic: ~4 chars per token. We only use this when the provider
    // doesn't stream usage back, so over/under-counting by a few tokens won't
    // hurt routing decisions in practice.
    if (!s) return 0;
    return Math.max(1, Math.ceil(s.length / 4));
}
