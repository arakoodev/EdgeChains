import axios from "axios";
import { config } from "dotenv";
config();
const openAI_url = "https://api.openai.com/v1/chat/completions";

interface ChatOpenAiOptions {
    url?: string;
    openAIApiKey?: string;
    orgId?: string;
    model?: string;
    role?: string;
    temperature?: number;
}

export class ChatOpenAi {
    url: string;
    openAIApiKey: string;
    orgId: string;
    model: string;
    role: string;
    temperature: number;

    constructor(options: ChatOpenAiOptions = {}) {
        this.url = options.url || openAI_url;
        this.openAIApiKey = options.openAIApiKey || process.env.OPENAI_API_KEY!; // and check it's there
        this.orgId = options.orgId || "";
        this.model = options.model || "gpt-3.5-turbo";
        this.role = options.role || "user";
        this.temperature = options.temperature || 0.5;
    }

    async generateResponse(prompt: string): Promise<string> {
        const responce = await axios
            .post(
                openAI_url,
                {
                    model: this.model,
                    messages: [
                        {
                            role: this.role,
                            content: prompt,
                        },
                    ],
                    temperature: this.temperature,
                },
                {
                    headers: {
                        Authorization: "Bearer " + this.openAIApiKey,
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
        return responce[0].message.content;
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
                        Authorization: `Bearer ${this.openAIApiKey}`,
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

    async chatWithAI(chatMessages: any) {
        const response = await axios
            .post(
                openAI_url,
                {
                    model: this.model,
                    messages: chatMessages,
                    temperature: this.temperature,
                },
                {
                    headers: {
                        Authorization: "Bearer " + this.openAIApiKey,
                        "content-type": "application/json",
                    },
                }
            )
            .then((response) => {
                return response.data.choices;
            })
            .catch((error) => {
                console.log({ error });
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

    async testResponseGeneration(prompt: string): Promise<string> {
        const responce = await axios
            .post(
                openAI_url,
                {
                    model: this.model,
                    messages: [
                        {
                            role: this.role,
                            content: prompt,
                        },
                    ],
                    temperature: this.temperature,
                },
                {
                    headers: {
                        Authorization: "Bearer " + this.openAIApiKey,
                        "content-type": "application/json",
                    },
                }
            )
            .then(function (response) {
                return response.data.choices;
            })
            .catch(function (error) {
                if (error.response) {
                    console.log("Server responded with status code:", error.response.status);
                    console.log("Response data:", error.response.data);
                } else if (error.request) {
                    console.log("No response received:", error.request);
                } else {
                    console.log("Error creating request:", error.message);
                }
            });
        return responce[0].message.content;
    }
}
