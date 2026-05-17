import { ChatModel, role } from "../../types/index";
import { OpenAiEndpoint, type RouterRoute } from "./OpenAiEndpoint.js";

interface OpenAIConstructionOptions {
    apiKey?: string;
    orgId?: string;
    url?: string;
    model?: ChatModel | string;
    role?: role;
    temperature?: number;
    routes?: RouterRoute[];
}

export class OpenAI extends OpenAiEndpoint {
    constructor(options: OpenAIConstructionOptions) {
        super({
            url: options.url || "https://api.openai.com/v1/chat/completions",
            apiKey: options.apiKey,
            orgId: options.orgId,
            model: options.model,
            role: options.role,
            temperature: options.temperature,
            routes: options.routes,
        });
    }
}

export { OpenAiEndpoint };
export type { RouterRoute };
