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

const COHERE_CHAT_URL = "https://api.cohere.ai/v1/chat";

function messagesFromRequest(request: CompletionRequest): Message[] {
    if (request.messages?.length) return request.messages;
    return [{ role: request.role || "user", content: request.prompt || "" }];
}

function buildBody(request: CompletionRequest, deployment: NormalizedDeployment, stream: boolean) {
    const messages = messagesFromRequest(request);
    const userMessages = messages.filter((message) => message.role === "user");
    const message = request.prompt ?? userMessages[userMessages.length - 1]?.content ?? "";
    const maxTokens = request.max_tokens ?? request.maxTokens ?? 256;

    return {
        model: deployment.model,
        message,
        chat_history: messages
            .slice(0, -1)
            .filter((item) => item.role !== "system")
            .map((item) => ({
                role: item.role === "assistant" ? "CHATBOT" : "USER",
                message: item.content,
            })),
        max_tokens: maxTokens,
        temperature: request.temperature ?? 0.7,
        stream,
    };
}

function headers(deployment: NormalizedDeployment): Record<string, string> {
    return {
        Authorization: `Bearer ${deployment.apiKey}`,
        "Content-Type": "application/json",
        ...(deployment.headers ?? {}),
    };
}

function usageFromMeta(meta: any): Usage {
    const tokens = meta?.tokens ?? {};
    const billed = meta?.billed_units ?? {};
    const prompt_tokens = tokens.input_tokens ?? billed.input_tokens ?? 0;
    const completion_tokens = tokens.output_tokens ?? billed.output_tokens ?? 0;
    return {
        prompt_tokens,
        completion_tokens,
        total_tokens: prompt_tokens + completion_tokens,
    };
}

export async function cohereCompletion(
    http: RouterHttpClient,
    deployment: NormalizedDeployment,
    request: CompletionRequest
): Promise<CompletionResponse> {
    const response = await http.post<any>(deployment.baseUrl || COHERE_CHAT_URL, buildBody(request, deployment, false), {
        headers: headers(deployment),
        timeout: deployment.timeoutMs,
    });

    const data = response.data;
    return {
        content: data?.text ?? "",
        usage: usageFromMeta(data?.meta),
        provider: deployment.provider,
        model: deployment.model,
        deployment_id: deployment.id,
        finish_reason: data?.finish_reason,
        raw: data,
    };
}

export async function* cohereStream(
    http: RouterHttpClient,
    deployment: NormalizedDeployment,
    request: CompletionRequest
): AsyncGenerator<StreamChunk> {
    const response = await http.post<any>(deployment.baseUrl || COHERE_CHAT_URL, buildBody(request, deployment, true), {
        headers: headers(deployment),
        timeout: deployment.timeoutMs,
        responseType: "stream",
    });

    let content = "";
    let usage: Usage | undefined;
    for await (const event of parseSSE(response.data)) {
        const data = event as any;
        if (data?.event_type === "stream-end") usage = usageFromMeta(data?.response?.meta);
        const delta = data?.text ?? data?.delta?.message?.content?.text ?? "";
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
        usage: usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        provider: deployment.provider,
        model: deployment.model,
        deployment_id: deployment.id,
    };
}
