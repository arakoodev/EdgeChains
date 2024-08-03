
import axios from "axios";
import { role } from "../../types";
import { retry } from "@lifeomic/attempt";

const url = 'https://api.llama-api.com/chat/completions'

interface messageOption {
    role: role;
    content: string;
    name?: string;
}

interface llamaChatOptions {
    model?: string;
    role?: role;
    max_tokens?: number;
    temperature?: number;
    prompt?: string;
    messages?: messageOption[];
    stream?: boolean
    max_retry?: number;
    delay?: number
}[]

export class LlamaAI {
    apiKey: string
    queue: string[]
    constructor({ apiKey }: { apiKey: string }) {
        this.apiKey = apiKey;
        this.queue = [];
    }

    async makeRequest(chatOptions: llamaChatOptions) {
        try {
            return await retry(async () => {

                return await axios
                    .post(
                        url,
                        {
                            model: chatOptions.model || "llama-13b-chat",
                            messages: chatOptions.prompt
                                ? [
                                    {
                                        role: chatOptions.role || "user",
                                        content: chatOptions.prompt,
                                    },
                                ]
                                : chatOptions.messages,
                            max_tokens: chatOptions.max_tokens || 1024,
                            stream: chatOptions.stream || false,
                            temperature: chatOptions.temperature || 0.7,
                        },
                        {
                            headers: { Authorization: "Bearer " + this.apiKey },
                        }
                    )
            }, { maxAttempts: chatOptions.max_retry || 3, delay: chatOptions.delay || 200 });
        } catch (error: any) {
            console.log(error)
            throw new Error(`Error while making request: ${error.message}`);
        }
    }

    async _runStreamForJupyter(apiRequestJson) {
        const response = await this.makeRequest(apiRequestJson);

        for (const chunk of response.data) {
            this.queue.push(chunk);
        }
    }

    async *getSequences() {
        while (this.queue.length > 0) {
            yield this.queue.shift();
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    async runStream(apiRequestJson) {
        await this._runStreamForJupyter(apiRequestJson);
        this.getSequences();
    }

    async runSync(apiRequestJson) {
        const response = await this.makeRequest(apiRequestJson);

        if (response.status !== 200) {
            throw new Error(`POST ${response.status} ${response.data.detail}`);
        }

        return response.data;
    }

    chat(chatOptions: llamaChatOptions) {
        if (chatOptions.stream) {
            return this.runStream(chatOptions);
        } else {
            return this.runSync(chatOptions);
        }
    }
}
