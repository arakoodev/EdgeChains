import axios from "axios";
import { zodToJsonSchema } from "zod-to-json-schema";
import { z } from "zod";
import { ChatModel, role } from "../../types/index";

const palm2_base_url = "https://generativelanguage.googleapis.com/v1beta2/models";

interface Palm2ConstructionOptions {
    apiKey?: string;
}

interface messageOption {
    author?: role;
    content: string;
}

interface Palm2ChatOptions {
    model?: string;
    prompt?: string;
    messages?: messageOption[];
    temperature?: number;
    candidateCount?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
}

interface chatWithFunctionOptions {
    model?: string;
    prompt?: string;
    messages?: messageOption[];
    temperature?: number;
    candidateCount?: number;
    functions?: object | Array<object>;
}

interface ZodSchemaResponseOptions<S extends z.ZodTypeAny> {
    model?: string;
    prompt: string;
    temperature?: number;
    schema: S;
}

interface chatWithFunctionReturnOptions {
    content: string;
    function_call?: {
        name: string;
        arguments: string;
    };
}

interface Palm2ChatReturnOptions {
    content: string;
    author: string;
}

export class Palm2 {
    apiKey: string;

    constructor(options: Palm2ConstructionOptions) {
        this.apiKey = options.apiKey || process.env.PALM2_API_KEY || "";
        this.checkKeys();
    }

    private checkKeys(): void {
        if (!this.apiKey) {
            console.error(
                "API key is missing. Please provide a valid Google Palm2 API key. You can add it in .env file as PALM2_API_KEY"
            );
        }
    }

    private buildMessages(chatOptions: Palm2ChatOptions): messageOption[] {
        if (chatOptions.prompt) {
            return [{ author: "user" as role, content: chatOptions.prompt }];
        }
        return chatOptions.messages || [];
    }

    private buildRequestBody(chatOptions: Palm2ChatOptions): object {
        return {
            prompt: {
                messages: this.buildMessages(chatOptions),
            },
            temperature: chatOptions.temperature ?? 0.7,
            candidateCount: chatOptions.candidateCount ?? 1,
            maxOutputTokens: chatOptions.maxOutputTokens,
            topP: chatOptions.topP,
            topK: chatOptions.topK,
        };
    }

    private getUrl(model: string, method: string): string {
        return `${palm2_base_url}/${model}:${method}?key=${this.apiKey}`;
    }

    async chat(chatOptions: Palm2ChatOptions): Promise<Palm2ChatReturnOptions> {
        const model = chatOptions.model || "chat-bison-001";
        const response = await axios
            .post(this.getUrl(model, "generateMessage"), this.buildRequestBody(chatOptions), {
                headers: { "content-type": "application/json" },
            })
            .then((response) => {
                return response.data.candidates;
            })
            .catch((error) => {
                if (error.response) {
                    console.log("Server responded with status code:", error.response.status);
                    console.log("Response data:", error.response.data);
                } else if (error.request) {
                    console.log("No response received:", error);
                } else {
                    console.log("Error creating request:", error.message);
                }
            });
        return response[0];
    }

    async streamedChat(chatOptions: Palm2ChatOptions): Promise<Palm2ChatReturnOptions> {
        const model = chatOptions.model || "chat-bison-001";
        const response = await axios
            .post(
                this.getUrl(model, "streamGenerateMessage"),
                this.buildRequestBody(chatOptions),
                {
                    headers: { "content-type": "application/json" },
                    responseType: "stream",
                }
            )
            .then((response) => {
                return new Promise<Palm2ChatReturnOptions[]>((resolve, reject) => {
                    let fullContent = "";
                    let author = "1";
                    response.data.on("data", (chunk: Buffer) => {
                        const lines = chunk.toString().split("\n");
                        for (const line of lines) {
                            if (line.startsWith("data: ")) {
                                try {
                                    const parsed = JSON.parse(line.slice(6));
                                    if (parsed.candidates && parsed.candidates.length > 0) {
                                        fullContent += parsed.candidates[0].content || "";
                                        author = parsed.candidates[0].author || author;
                                    }
                                } catch {
                                    // skip malformed JSON chunks
                                }
                            }
                        }
                    });
                    response.data.on("end", () => {
                        resolve([{ content: fullContent, author }]);
                    });
                    response.data.on("error", reject);
                });
            })
            .catch((error) => {
                if (error.response) {
                    console.log("Server responded with status code:", error.response.status);
                    console.log("Response data:", error.response.data);
                } else if (error.request) {
                    console.log("No response received:", error);
                } else {
                    console.log("Error creating request:", error.message);
                }
            });
        return response[0];
    }

    async chatWithFunction(
        chatOptions: chatWithFunctionOptions
    ): Promise<chatWithFunctionReturnOptions> {
        const model = chatOptions.model || "chat-bison-001";
        const functions = chatOptions.functions
            ? Array.isArray(chatOptions.functions)
                ? chatOptions.functions
                : [chatOptions.functions]
            : [];

        const response = await axios
            .post(
                this.getUrl(model, "generateMessage"),
                {
                    ...this.buildRequestBody(chatOptions),
                    tools: functions.length > 0 ? [{ functionDeclarations: functions }] : undefined,
                },
                {
                    headers: { "content-type": "application/json" },
                }
            )
            .then((response) => {
                return response.data.candidates;
            })
            .catch((error) => {
                if (error.response) {
                    console.log("Server responded with status code:", error.response.status);
                    console.log("Response data:", error.response.data);
                } else if (error.request) {
                    console.log("No response received:", error);
                } else {
                    console.log("Error creating request:", error.message);
                }
            });

        const candidate = response[0];
        return {
            content: candidate.content || "",
            function_call: candidate.functionCall
                ? {
                      name: candidate.functionCall.name,
                      arguments: JSON.stringify(candidate.functionCall.args),
                  }
                : undefined,
        };
    }

    async chatWithZodSchema<S extends z.ZodTypeAny>(
        options: ZodSchemaResponseOptions<S>
    ): Promise<Palm2ChatReturnOptions> {
        const model = options.model || "chat-bison-001";
        const jsonSchema = zodToJsonSchema(options.schema);

        const response = await axios
            .post(
                this.getUrl(model, "generateMessage"),
                {
                    ...this.buildRequestBody({
                        prompt: options.prompt,
                        temperature: options.temperature,
                    }),
                },
                {
                    headers: { "content-type": "application/json" },
                    params: {
                        key: this.apiKey,
                    },
                }
            )
            .then((response) => {
                return response.data.candidates;
            })
            .catch((error) => {
                if (error.response) {
                    console.log("Server responded with status code:", error.response.status);
                    console.log("Response data:", error.response.data);
                } else if (error.request) {
                    console.log("No response received:", error);
                } else {
                    console.log("Error creating request:", error.message);
                }
            });
        return response[0];
    }
}
