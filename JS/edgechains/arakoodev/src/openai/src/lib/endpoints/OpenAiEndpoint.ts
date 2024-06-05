import axios from "axios";
import { zodToJsonSchema } from 'zod-to-json-schema';
import { z } from "zod";
import { ChatModel, role } from "../../types/index"
const openAI_url = "https://api.openai.com/v1/chat/completions";

interface OpenAIConstructionOptions {
    apiKey?: string;
}

interface messageOption {
    role: role;
    content: string;
    name?: string;
}
[];

interface OpenAIChatOptions {
    model?: ChatModel;
    role?: role;
    max_tokens?: number;
    temperature?: number;
    prompt?: string;
    messages?: messageOption;
}

interface chatWithFunctionOptions {
    model?: ChatModel;
    role?: role;
    max_tokens?: number;
    temperature?: number;
    prompt?: string;
    functions?: object | Array<object>;
    messages?: messageOption;
    function_call?: string;
}

interface ZodSchemaResponseOptions<S extends z.ZodTypeAny> {
    model?: ChatModel;
    role?: role;
    max_tokens?: number;
    temperature?: number;
    prompt: string;
    schema: S;
}

interface chatWithFunctionReturnOptions {
    content: string;
    function_call: {
        name: string;
        arguments: string;
    };
}

interface OpenAIChatReturnOptions {
    content: string;
}

export class OpenAI {
    apiKey: string;
    constructor(options: OpenAIConstructionOptions) {
        this.apiKey = options.apiKey || process.env.OPENAI_API_KEY || "";
    }

    async chat(chatOptions: OpenAIChatOptions): Promise<OpenAIChatReturnOptions> {
        const responce = await axios
            .post(
                openAI_url,
                {
                    model: chatOptions.model || "gpt-3.5-turbo",
                    messages: chatOptions.prompt
                        ? [
                            {
                                role: chatOptions.role || "user",
                                content: chatOptions.prompt,
                            },
                        ]
                        : chatOptions.messages,
                    max_tokens: chatOptions.max_tokens || 256,
                    temperature: chatOptions.temperature || 0.7,
                },
                {
                    headers: {
                        Authorization: "Bearer " + this.apiKey,
                        "content-type": "application/json",
                    },
                }
            )
            .then((response) => {
                return response.data.choices;
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
        return responce[0].message;
    }

    async chatWithFunction(
        chatOptions: chatWithFunctionOptions
    ): Promise<chatWithFunctionReturnOptions> {
        const responce = await axios
            .post(
                openAI_url,
                {
                    model: chatOptions.model || "gpt-3.5-turbo",
                    messages: chatOptions.prompt
                        ? [
                            {
                                role: chatOptions.role || "user",
                                content: chatOptions.prompt,
                            },
                        ]
                        : chatOptions.messages,
                    max_tokens: chatOptions.max_tokens || 256,
                    temperature: chatOptions.temperature || 0.7,
                    functions: chatOptions.functions,
                    function_call: chatOptions.function_call || "auto",
                },
                {
                    headers: {
                        Authorization: "Bearer " + this.apiKey,
                        "content-type": "application/json",
                    },
                }
            )
            .then((response) => {
                return response.data.choices;
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
        return responce[0].message;
    }

    async generateEmbeddings(resp): Promise<any> {
        const response = await axios
            .post(
                "https://api.openai.com/v1/embeddings",
                {
                    model: "text-embedding-ada-002",
                    input: resp,
                },
                {
                    headers: {
                        Authorization: `Bearer ${this.apiKey}`,
                        "content-type": "application/json",
                    },
                }
            )
            .then((response) => {
                return response.data.data;
            })
            .catch((error) => {
                if (error.response) {
                    console.log("Server responded with status code:", error.response.status);
                    console.log("Response data:", error.response.data);
                } else if (error.request) {
                    console.log("No response received:", error.request);
                } else {
                    console.log("Error creating request:", error.message);
                }
            });
        return response;
    }

    async zodSchemaResponse<S extends z.ZodTypeAny>(
        chatOptions: ZodSchemaResponseOptions<S>
    ): Promise<S> {
        const jsonSchema = zodToJsonSchema(chatOptions.schema, { $refStrategy: 'none' });
        const openAIFunctionCallDefinition = {
            name: "generateSchema",
            description: "Generate a schema based on provided details.",
            parameters: jsonSchema
        };
        // Remembrer if any field like url or link is not available please create a dummy link based on the following prompt
        const content = `
                        You are a Schema generator that can generate answer based on given prompt and then return the response based on the give schema 
                        Remembrer if any field like url or link is not available please create a dummy link based on the following prompt
                        
                        prompt:
                        ${chatOptions.prompt || ""}
                        `;

        const response = await axios
            .post(
                openAI_url,
                {
                    model: chatOptions.model || "gpt-3.5-turbo",
                    messages: [
                        {
                            role: chatOptions.role || "user",
                            content
                        },
                    ],
                    functions: [openAIFunctionCallDefinition],
                    function_call: "auto",
                    max_tokens: chatOptions.max_tokens || 1000,
                    temperature: chatOptions.temperature || 0.7,
                },
                {
                    headers: {
                        Authorization: "Bearer " + this.apiKey,
                        "content-type": "application/json",
                    },
                }
            )
            .then((response) => {
                return response.data.choices[0].message
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
        if (response) {
            if (response.content) return response.content
            return chatOptions.schema.parse(JSON.parse(response.function_call.arguments));

        } else {
            throw new Error("Response did not contain valid JSON.");
        }
    }
}
