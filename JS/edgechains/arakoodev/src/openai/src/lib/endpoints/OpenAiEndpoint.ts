import axios from "axios";
import { config } from "dotenv";
config();
const openAI_url = "https://api.openai.com/v1/chat/completions";

interface OpenAIConstructionOptions {
    apiKey?: string;
}

interface messageOption {
    role: string;
    content: string;
    name?: string;
}

interface OpenAIChatOptions {
    model?: string;
    role?: string;
    max_tokens?: number;
    temperature?: number;
    prompt?: string;
    messages?: messageOption[];
}

interface chatWithFunctionOptions {
    model?: string;
    role?: string;
    max_tokens?: number;
    temperature?: number;
    prompt?: string;
    functions?: object | Array<object>;
    messages?: messageOption[];
    function_call?: string;
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
                    messages: chatOptions.prompt ? [
                        {
                            role: chatOptions.role || "user",
                            content: chatOptions.prompt,
                        },
                    ] : chatOptions.messages,
                    max_tokens: chatOptions.max_tokens || 256,
                    temperature: chatOptions.temperature || 0.7,
                },
                {
                    headers: {
                        Authorization: "Bearer " + this.apiKey,
                        "content-type": "application/json",
                    },
                },
            )
            .then((response) => {
                return response.data.choices;
            })
            .catch((error) => {
                if (error.response) {
                    console.log(
                        "Server responded with status code:",
                        error.response.status,
                    );
                    console.log("Response data:", error.response.data);
                } else if (error.request) {
                    console.log("No response received:", error);
                } else {
                    console.log("Error creating request:", error.message);
                }
            });
        return responce[0].message;
    }

    async chatWithFunction(chatOptions: chatWithFunctionOptions): Promise<chatWithFunctionReturnOptions> {
        const responce = await axios
            .post(
                openAI_url,
                {
                    model: chatOptions.model || "gpt-3.5-turbo",
                    messages: chatOptions.prompt ? [
                        {
                            role: chatOptions.role || "user",
                            content: chatOptions.prompt,
                        },
                    ] : chatOptions.messages,
                    max_tokens: chatOptions.max_tokens || 256,
                    temperature: chatOptions.temperature || 0.7,
                    functions: chatOptions.functions,
                    function_call: chatOptions.function_call || "auto"
                },
                {
                    headers: {
                        Authorization: "Bearer " + this.apiKey,
                        "content-type": "application/json",
                    },
                },
            )
            .then((response) => {
                return response.data.choices;
            })
            .catch((error) => {
                if (error.response) {
                    console.log(
                        "Server responded with status code:",
                        error.response.status,
                    );
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
                },
            )
            .then((response) => {
                return response.data.data;
            })
            .catch((error) => {
                if (error.response) {
                    console.log(
                        "Server responded with status code:",
                        error.response.status,
                    );
                    console.log("Response data:", error.response.data);
                } else if (error.request) {
                    console.log("No response received:", error.request);
                } else {
                    console.log("Error creating request:", error.message);
                }
            });
        return response;
    }

}

