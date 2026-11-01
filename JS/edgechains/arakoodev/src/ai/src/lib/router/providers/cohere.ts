import { AxiosInstance } from "axios";
import { ChatRequest, ChatResponse, Deployment, StreamChunk, Usage } from "../types.js";
import { parseSSE } from "../sse.js";

const CHAT_URL = "https://api.cohere.ai/v1/chat";

function buildBody(req: ChatRequest, deployment: Deployment, stream: boolean) {
    const message =
        req.prompt ??
        (req.messages ?? [])
            .filter((m) => m.role === "user")
            .slice(-1)[0]?.content ??
        "";
    const chat_history =
        (req.messages ?? [])
            .slice(0, -1)
            .filter((m) => m.role !== "system")
            .map((m) => ({
                role: m.role === "assistant" ? "CHATBOT" : "USER",
                message: m.content,
            }));
    return {
        model: deployment.model,
        message,
        chat_history,
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

function usageFromMeta(meta: any): Usage {
    // Cohere reports tokens under either `meta.tokens` or `meta.billed_units`
    // depending on API version. Take whichever is populated.
    const t = meta?.tokens ?? {};
    const b = meta?.billed_units ?? {};
    const prompt_tokens = t.input_tokens ?? b.input_tokens ?? 0;
    const completion_tokens = t.output_tokens ?? b.output_tokens ?? 0;
    return {
        prompt_tokens,
        completion_tokens,
        total_tokens: prompt_tokens + completion_tokens,
    };
}

export async function cohereChat(
    http: AxiosInstance,
    deployment: Deployment,
    req: ChatRequest
): Promise<ChatResponse> {
    const resp = await http.post(CHAT_URL, buildBody(req, deployment, false), {
        headers: headers(deployment),
        timeout: deployment.timeout_ms,
    });
    const data = resp.data;
    const content: string = data?.text ?? "";
    return {
        content,
        usage: usageFromMeta(data?.meta),
        deployment_id: deployment.id!,
        provider: deployment.provider,
        model: deployment.model,
    };
}

export async function* cohereStream(
    http: AxiosInstance,
    deployment: Deployment,
    req: ChatRequest
): AsyncGenerator<StreamChunk> {
    const resp = await http.post(CHAT_URL, buildBody(req, deployment, true), {
        headers: headers(deployment),
        timeout: deployment.timeout_ms,
        responseType: "stream",
    });

    let usage: Usage | undefined;

    for await (const event of parseSSE(resp.data)) {
        if (!event.data) continue;
        let json: any;
        try {
            json = JSON.parse(event.data);
        } catch {
            continue;
        }
        if (json?.event_type === "text-generation" && typeof json.text === "string") {
            yield {
                delta: json.text,
                done: false,
                deployment_id: deployment.id!,
                provider: deployment.provider,
                model: deployment.model,
            };
        } else if (json?.event_type === "stream-end") {
            usage = usageFromMeta(json?.response?.meta);
        }
    }

    yield {
        delta: "",
        done: true,
        usage: usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        deployment_id: deployment.id!,
        provider: deployment.provider,
        model: deployment.model,
    };
}
