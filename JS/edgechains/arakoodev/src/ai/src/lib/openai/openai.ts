import axios from "axios";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ChatModel, role } from "../../types/index.js";
import { SmartRouter } from "../router/SmartRouter.js";
import type {
    DeploymentConfig,
    RouterLoggingConfig,
    RouterReliabilityConfig,
    TokenUsage,
} from "../router/types.js";

const openAI_url = "https://api.openai.com/v1/chat/completions";

export interface OpenAIConstructionOptions {
    apiKey?: string;
    orgId?: string;
    endpoint?: string;
    model?: string;
    role?: role;
    temperature?: number;
    deployments?: DeploymentConfig[];
    reliability?: RouterReliabilityConfig;
    logging?: RouterLoggingConfig;
    router?: SmartRouter;
}

export interface messageOption {
    role: role | "agent";
    content: string;
    name?: string;
}

export interface OpenAIChatOptions {
    model?: ChatModel | string;
    role?: role;
    max_tokens?: number;
    temperature?: number;
    prompt?: string;
    messages?: messageOption[];
    frequency_penalty?: number;
}

export interface chatWithFunctionOptions {
    model?: ChatModel | string;
    role?: role;
    max_tokens?: number;
    temperature?: number;
    prompt?: string;
    functions?: object | Array<object>;
    messages?: messageOption[];
    function_call?: string | { name: string };
}

export interface ZodSchemaResponseOptions<S extends z.ZodTypeAny> {
    model?: ChatModel | string;
    role?: role;
    max_tokens?: number;
    temperature?: number;
    prompt: string;
    schema: S;
}

export interface chatWithFunctionReturnOptions {
    content: string;
    function_call: {
        name: string;
        arguments: string;
    };
    usage?: TokenUsage;
}

export interface OpenAIChatReturnOptions {
    content: string;
    role?: role;
    usage?: TokenUsage;
}

/**
 * `OpenAI` / `Endpoint` / `OpenAiEndpoint` class backed by `SmartRouter`.
 * Replaces the legacy single-endpoint implementation with multi-deployment routing,
 * rate-limit failover, streaming, token usage tracking, and Sentry/PostHog logging.
 */
export class OpenAI {
    apiKey: string;
    orgId: string;
    endpointUrl: string;
    defaultModel: string;
    defaultRole: role;
    defaultTemperature: number;
    public readonly router: SmartRouter;

    constructor(
        optionsOrUrl: OpenAIConstructionOptions | string = {},
        apiKey?: string,
        orgId?: string,
        model?: string,
        defaultRole?: role,
        temperature?: number
    ) {
        if (typeof optionsOrUrl === "string") {
            this.endpointUrl = optionsOrUrl || openAI_url;
            this.apiKey = apiKey || process.env.OPENAI_API_KEY || "";
            this.orgId = orgId || process.env.OPENAI_ORG_ID || "";
            this.defaultModel = model || "gpt-3.5-turbo";
            this.defaultRole = defaultRole || "user";
            this.defaultTemperature = typeof temperature === "number" ? temperature : 0.7;
            this.router = new SmartRouter({
                deployments: [
                    {
                        id: "openai-default",
                        modelName: this.defaultModel,
                        provider: "openai",
                        model: this.defaultModel,
                        apiKey: this.apiKey,
                        orgId: this.orgId,
                        endpoint: this.endpointUrl,
                    },
                ],
            });
        } else {
            this.apiKey = optionsOrUrl.apiKey || process.env.OPENAI_API_KEY || "";
            this.orgId = optionsOrUrl.orgId || process.env.OPENAI_ORG_ID || "";
            this.endpointUrl = optionsOrUrl.endpoint || openAI_url;
            this.defaultModel = optionsOrUrl.model || "gpt-3.5-turbo";
            this.defaultRole = optionsOrUrl.role || "user";
            this.defaultTemperature =
                typeof optionsOrUrl.temperature === "number" ? optionsOrUrl.temperature : 0.7;

            if (optionsOrUrl.router) {
                this.router = optionsOrUrl.router;
            } else {
                const deployments: DeploymentConfig[] =
                    optionsOrUrl.deployments && optionsOrUrl.deployments.length > 0
                        ? optionsOrUrl.deployments
                        : [
                              {
                                  id: "openai-default",
                                  modelName: this.defaultModel,
                                  provider: "openai",
                                  model: this.defaultModel,
                                  apiKey: this.apiKey,
                                  orgId: this.orgId,
                                  endpoint: this.endpointUrl,
                              },
                          ];
                this.router = new SmartRouter({
                    deployments,
                    reliability: optionsOrUrl.reliability,
                    logging: optionsOrUrl.logging,
                });
            }
        }
        this.checkKeys();
    }

    private checkKeys(): void {
        if (!this.apiKey && this.router.getDeploymentStates().every((d) => !d.config.apiKey)) {
            console.error(
                "API key is missing. Please provide a valid OpenAI API key. You can add it in .env file as OPENAI_API_KEY"
            );
        }
        if (!this.orgId) {
            console.warn(
                "Organization ID is missing. Please provide a valid OpenAI Organization ID. You can add it in .env file as OPENAI_ORG_ID"
            );
        }
    }

    async chat(chatOptions: OpenAIChatOptions): Promise<OpenAIChatReturnOptions> {
        const result = await this.router.completion({
            model: chatOptions.model || this.defaultModel,
            role: chatOptions.role || this.defaultRole,
            prompt: chatOptions.prompt,
            messages: chatOptions.messages,
            max_tokens: chatOptions.max_tokens ?? 256,
            temperature: chatOptions.temperature ?? this.defaultTemperature,
            frequency_penalty: chatOptions.frequency_penalty ?? 1,
        });
        return {
            content: result.content,
            role: result.role,
            usage: result.usage,
        };
    }

    async streamedChat(chatOptions: OpenAIChatOptions): Promise<OpenAIChatReturnOptions> {
        let content = "";
        let finalUsage: TokenUsage | undefined;
        for await (const chunk of this.router.stream({
            model: chatOptions.model || this.defaultModel,
            role: chatOptions.role || this.defaultRole,
            prompt: chatOptions.prompt,
            messages: chatOptions.messages,
            max_tokens: chatOptions.max_tokens ?? 256,
            temperature: chatOptions.temperature ?? this.defaultTemperature,
            frequency_penalty: chatOptions.frequency_penalty ?? 1,
            stream: true,
        })) {
            if (chunk.done) {
                finalUsage = chunk.usage;
            } else {
                content += chunk.delta;
            }
        }
        return {
            content,
            role: "assistant",
            usage: finalUsage,
        };
    }

    async chatWithFunction(
        chatOptions: chatWithFunctionOptions
    ): Promise<chatWithFunctionReturnOptions> {
        const fnCallArg =
            typeof chatOptions.function_call === "object"
                ? JSON.stringify(chatOptions.function_call)
                : chatOptions.function_call || "auto";
        const result = await this.router.completion({
            model: chatOptions.model || this.defaultModel,
            role: chatOptions.role || this.defaultRole,
            prompt: chatOptions.prompt,
            messages: chatOptions.messages,
            max_tokens: chatOptions.max_tokens ?? 1024,
            temperature: chatOptions.temperature ?? this.defaultTemperature,
            functions: chatOptions.functions,
            function_call: fnCallArg,
        });
        return {
            content: result.content,
            function_call: result.function_call || { name: "", arguments: "{}" },
            usage: result.usage,
        };
    }

    async generateEmbeddings(
        inputOrOptions: { input: string[]; model: string } | string
    ): Promise<any> {
        const payload =
            typeof inputOrOptions === "string"
                ? { model: "text-embedding-ada-002", input: [inputOrOptions] }
                : { model: inputOrOptions.model, input: inputOrOptions.input };

        const response = await axios.post("https://api.openai.com/v1/embeddings", payload, {
            headers: {
                Authorization: `Bearer ${this.apiKey}`,
                "content-type": "application/json",
                "OpenAI-Organization": this.orgId,
            },
        });
        return response?.data?.data;
    }

    async embeddings(input: string): Promise<number[]> {
        const data = await this.generateEmbeddings(input);
        if (Array.isArray(data) && data[0]?.embedding) {
            return data[0].embedding;
        }
        return data;
    }

    async gptFn(prompt: string): Promise<string> {
        const res = await this.chat({ prompt });
        return res.content;
    }

    async gptFnChat(messages: messageOption[]): Promise<string> {
        const res = await this.chat({ messages });
        return res.content;
    }

    async gptFnTestGenerator(prompt: string): Promise<string> {
        const res = await this.chat({ prompt, max_tokens: 1024 });
        return res.content;
    }

    async zodSchemaResponse<S extends z.ZodTypeAny>(
        chatOptions: ZodSchemaResponseOptions<S>
    ): Promise<z.infer<S>> {
        const jsonSchema = zodToJsonSchema(chatOptions.schema, { $refStrategy: "none" });
        const openAIFunctionCallDefinition = {
            name: "generateSchema",
            description: "Generate a schema based on provided details.",
            parameters: jsonSchema,
        };
        const content = `
                        You are a Schema generator that can generate answer based on given prompt and then return the response based on the give schema 
                        Remembrer if any field like url or link is not available please create a dummy link based on the following prompt
                        
                        prompt:
                        ${chatOptions.prompt || ""}
                        `;

        const response = await this.chatWithFunction({
            model: chatOptions.model || "gpt-3.5-turbo-16k",
            role: chatOptions.role || "user",
            messages: [
                {
                    role: chatOptions.role || "user",
                    content,
                },
            ],
            functions: [openAIFunctionCallDefinition],
            function_call: "auto",
            max_tokens: chatOptions.max_tokens || 1000,
            temperature: chatOptions.temperature || 0.7,
        });

        if (response) {
            if (response.content) {
                return response.content;
            }
            if (response.function_call?.arguments) {
                return chatOptions.schema.parse(JSON.parse(response.function_call.arguments));
            }
        }
        throw new Error("Response did not contain valid JSON.");
    }
}

export class Stream {
    private router: SmartRouter;
    private model: string;
    private temperature: number;
    private maxTokens: number;

    constructor(options: {
        model?: string;
        OpenApiKey?: string;
        apiKey?: string;
        temperature?: number;
        max_tokens?: number;
        router?: SmartRouter;
        [key: string]: any;
    }) {
        this.model = options.model || "gpt-3.5-turbo";
        this.temperature = options.temperature ?? 0.7;
        this.maxTokens = options.max_tokens ?? 500;
        this.router =
            options.router ||
            new SmartRouter({
                deployments: [
                    {
                        id: "stream-default",
                        modelName: this.model,
                        provider: "openai",
                        model: this.model,
                        apiKey: options.OpenApiKey || options.apiKey || "",
                    },
                ],
            });
    }

    OpenAIStream(prompt: string): ReadableStream<Uint8Array> {
        return this.router.createReadableStream({
            model: this.model,
            prompt,
            temperature: this.temperature,
            max_tokens: this.maxTokens,
            stream: true,
        });
    }
}

export { OpenAI as Endpoint, OpenAI as OpenAiEndpoint };
