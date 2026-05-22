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

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";

function messagesFromRequest(request: CompletionRequest): Message[] {
    if (request.messages?.length) return request.messages;
    return [
        {
            role: request.role || "user",
            content: request.prompt || "",
        },
    ];
}

function buildBody(request: CompletionRequest, deployment: NormalizedDeployment, stream: boolean) {
    const maxTokens = request.max_tokens ?? request.maxTokens ?? 256;
    return {
        model: deployment.model,
        messages: messagesFromRequest(request),
        max_tokens: maxTokens,
        temperature: request.temperature ?? 0.7,
        stream,
        ...(request.stop ? { stop: request.stop } : {}),
        ...(request.tools ? { tools: request.tools } : {}),
        ...(request.functions ? { functions: request.functions } : {}),
        ...(request.function_call ? { function_call: request.function_call } : {}),
    };
}

function headers(deployment: NormalizedDeployment): Record<string, string> {
    return {
        Authorization: `Bearer ${deployment.apiKey}`,
        "content-type": "application/json",
        ...(deployment.organization ? { "OpenAI-Organization": deployment.organization } : {}),
        ...(deployment.headers ?? {}),
    };
}

function usageFrom(data: any): Usage {
    return {
        prompt_tokens: data?.usage?.prompt_tokens ?? 0,
        completion_tokens: data?.usage?.completion_tokens ?? 0,
        total_tokens: data?.usage?.total_tokens ?? 0,
    };
}

export async function openaiCompletion(
    http: RouterHttpClient,
    deployment: NormalizedDeployment,
    request: CompletionRequest
): Promise<CompletionResponse> {
    const response = await http.post<any>(deployment.baseUrl || OPENAI_CHAT_URL, buildBody(request, deployment, false), {
        headers: headers(deployment),
        timeout: deployment.timeoutMs,
    });

    const data = response.data;
    const choice = data?.choices?.[0];
    return {
        content: choice?.message?.content ?? "",
        usage: usageFrom(data),
        provider: deployment.provider,
        model: deployment.model,
        deployment_id: deployment.id,
        finish_reason: choice?.finish_reason,
        raw: data,
    };
}

export async function* openaiStream(
    http: RouterHttpClient,
    deployment: NormalizedDeployment,
    request: CompletionRequest
): AsyncGenerator<StreamChunk> {
    const response = await http.post<any>(deployment.baseUrl || OPENAI_CHAT_URL, buildBody(request, deployment, true), {
        headers: headers(deployment),
        timeout: deployment.timeoutMs,
        responseType: "stream",
    });

    let content = "";
    let usage: Usage | undefined;

    for await (const event of parseSSE(response.data)) {
        const data = event as any;
        const delta = data?.choices?.[0]?.delta?.content ?? "";
        if (data?.usage) usage = usageFrom(data);
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
