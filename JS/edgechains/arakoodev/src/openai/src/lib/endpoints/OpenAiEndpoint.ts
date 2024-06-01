import axios from "axios";
import { printNode, zodToTs } from "zod-to-ts";
import { z } from "zod";
const openAI_url = "https://api.openai.com/v1/chat/completions";

type role = "user" | "assistant" | "system";

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
    model?: string;
    role?: role;
    max_tokens?: number;
    temperature?: number;
    prompt?: string;
    messages?: messageOption;
}

interface chatWithFunctionOptions {
    model?: string;
    role?: role;
    max_tokens?: number;
    temperature?: number;
    prompt?: string;
    functions?: object | Array<object>;
    messages?: messageOption;
    function_call?: string;
}

interface ZodSchemaResponseOptions<S extends z.ZodTypeAny> {
    model?: string;
    role?: role;
    max_tokens?: number;
    temperature?: number;
    prompt?: string;
    messages?: messageOption;
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
        const { node } = zodToTs(chatOptions.schema, "User");

        const content = `
                    Analyze the text enclosed in triple backticks below. Your task is to fill in the data as described, and respond only with a JSON object that strictly conforms to the following TypeScript schema. Do not include any additional text or explanations outside of the JSON object, as this will cause parsing errors.

                    Schema:
                    \`\`\`
                    ${printNode(node)}
                    \`\`\`

                    User Prompt:
                    \`\`\`
                    ${chatOptions.prompt || "No prompt provided."}
                    \`\`\`
                    `;

        const response = await axios
            .post(
                openAI_url,
                {
                    model: chatOptions.model || "gpt-3.5-turbo",
                    messages: chatOptions.prompt
                        ? [
                              {
                                  role: chatOptions.role || "user",
                                  content,
                              },
                          ]
                        : [
                              {
                                  role: chatOptions?.messages?.role || "user",
                                  content,
                              },
                          ],
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
                return response.data.choices[0].message.content;
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
        if (typeof response === "string") {
            return chatOptions.schema.parse(JSON.parse(response));
        } else {
            throw Error("response must be a string");
        }
    }
}
