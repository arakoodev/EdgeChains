import type {
    CompletionRequest,
    CompletionResponse,
    Message,
    NormalizedDeployment,
    RouterHttpClient,
    StreamChunk,
    Usage,
} from "../types.js";
import { parseSSE } from "../sse.js";

function messagesFromRequest(request: CompletionRequest): Message[] {
    if (request.messages?.length) return request.messages;
    return [{ role: request.role || "user", content: request.prompt || "" }];
}

function promptFromRequest(request: CompletionRequest): string {
    return messagesFromRequest(request)
        .map((message) => message.content)
        .join("\n");
}

function isGeminiModel(model: string): boolean {
    return model.startsWith("gemini") || model.includes("gemini");
}

function completionUrl(deployment: NormalizedDeployment, stream: boolean): string {
    if (deployment.baseUrl) return deployment.baseUrl;
    const encodedModel = encodeURIComponent(deployment.model);
    const key = encodeURIComponent(deployment.apiKey);
    if (isGeminiModel(deployment.model)) {
        const method = stream ? "streamGenerateContent" : "generateContent";
        return `https://generativelanguage.googleapis.com/v1beta/models/${encodedModel}:${method}?key=${key}`;
    }
    return `https://generativelanguage.googleapis.com/v1beta2/models/${encodedModel}:generateText?key=${key}`;
}

function buildBody(request: CompletionRequest, deployment: NormalizedDeployment) {
    const maxTokens = request.max_tokens ?? request.maxTokens ?? 256;
    if (isGeminiModel(deployment.model)) {
        return {
            contents: messagesFromRequest(request).map((message) => ({
                role: message.role === "assistant" ? "model" : "user",
                parts: [{ text: message.content }],
            })),
            generationConfig: {
                maxOutputTokens: maxTokens,
                temperature: request.temperature ?? 0.7,
                ...(request.stop ? { stopSequences: Array.isArray(request.stop) ? request.stop : [request.stop] } : {}),
            },
        };
    }

    return {
        prompt: { text: promptFromRequest(request) },
        maxOutputTokens: maxTokens,
        temperature: request.temperature ?? 0.7,
        ...(request.stop ? { stopSequences: Array.isArray(request.stop) ? request.stop : [request.stop] } : {}),
    };
}

function headers(deployment: NormalizedDeployment): Record<string, string> {
    return {
        "Content-Type": "application/json",
        ...(deployment.baseUrl ? { "x-goog-api-key": deployment.apiKey } : {}),
        ...(deployment.headers ?? {}),
    };
}

function usageFrom(data: any, content: string): Usage {
    const prompt_tokens = data?.usageMetadata?.promptTokenCount ?? 0;
    const completion_tokens = data?.usageMetadata?.candidatesTokenCount ?? data?.usageMetadata?.completionTokenCount ?? 0;
    const total_tokens = data?.usageMetadata?.totalTokenCount ?? prompt_tokens + completion_tokens;

    if (total_tokens > 0) return { prompt_tokens, completion_tokens, total_tokens };

    // PaLM generateText historically does not always return usage; keep a
    // conservative estimate so router TPM accounting still moves forward.
    const estimated = Math.max(1, Math.ceil(content.length / 4));
    return { prompt_tokens: 0, completion_tokens: estimated, total_tokens: estimated };
}

function contentFrom(data: any): string {
    return (
        data?.candidates?.[0]?.content?.parts?.map((part: any) => part.text).join("") ??
        data?.candidates?.[0]?.output ??
        data?.candidates?.[0]?.text ??
        ""
    );
}

export async function googleCompletion(
    http: RouterHttpClient,
    deployment: NormalizedDeployment,
    request: CompletionRequest
): Promise<CompletionResponse> {
    const response = await http.post<any>(completionUrl(deployment, false), buildBody(request, deployment), {
        headers: headers(deployment),
        timeout: deployment.timeoutMs,
    });

    const data = response.data;
    const content = contentFrom(data);
    return {
        content,
        usage: usageFrom(data, content),
        provider: deployment.provider,
        model: deployment.model,
        deployment_id: deployment.id,
        finish_reason: data?.candidates?.[0]?.finishReason,
        raw: data,
    };
}

export async function* googleStream(
    http: RouterHttpClient,
    deployment: NormalizedDeployment,
    request: CompletionRequest
): AsyncGenerator<StreamChunk> {
    // PaLM generateText does not expose a stable streaming endpoint. For PaLM
    // deployments, emit the full completion as one chunk so callers can keep a
    // single streaming interface. Gemini uses streamGenerateContent.
    if (!isGeminiModel(deployment.model)) {
        const response = await googleCompletion(http, deployment, request);
        yield {
            delta: response.content,
            content: response.content,
            provider: deployment.provider,
            model: deployment.model,
            deployment_id: deployment.id,
            raw: response.raw,
        };
        yield { ...response, done: true };
        return;
    }

    const response = await http.post<any>(completionUrl(deployment, true), buildBody(request, deployment), {
        headers: headers(deployment),
        timeout: deployment.timeoutMs,
        responseType: "stream",
    });

    let content = "";
    let usage: Usage | undefined;
    for await (const event of parseSSE(response.data)) {
        const data = event as any;
        const delta = contentFrom(data);
        if (data?.usageMetadata) usage = usageFrom(data, delta);
        if (!delta) continue;
        content += delta;
        yield {
            delta,
            content,
            provider: deployment.provider,
            model: deployment.model,
            deployment_id: deployment.id,
            raw: data,
        };
    }

    yield {
        done: true,
        content,
        usage: usage ?? { prompt_tokens: 0, completion_tokens: Math.ceil(content.length / 4), total_tokens: Math.ceil(content.length / 4) },
        provider: deployment.provider,
        model: deployment.model,
        deployment_id: deployment.id,
    };
}
