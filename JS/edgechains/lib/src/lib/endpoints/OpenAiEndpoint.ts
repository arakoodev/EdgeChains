import axios from "axios";

export class OpenAiEndpoint {
    url: string;
    apiKey: string;
    orgId: string;
    model: string;
    role: string;
    temprature: number;

    constructor(
        url: string,
        apiKey: string,
        orgId: string,
        model: string,
        role: string,
        temprature: number
    ) {
        this.url = url;
        this.apiKey = apiKey;
        this.orgId = orgId;
        this.model = model;
        this.role = role;
        this.temprature = temprature;
    }

    async gptFn(prompt: string): Promise<string> {
        const responce = await axios
            .post(
                "https://api.openai.com/v1/chat/completions",
                {
                    model: this.model,
                    messages: [
                        {
                            role: this.role,
                            content: prompt,
                        },
                    ],
                    temperature: this.temprature,
                },
                {
                    headers: {
                        Authorization: "Bearer " + this.apiKey,
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

    async embeddings(resp: string): Promise<number[]> {
        const responce = await axios
            .post(
                "https://api.openai.com/v1/embeddings",
                {
                    model: "text-embedding-ada-002",
                    input: resp,
                },
                {
                    headers: {
                        Authorization: "Bearer " + this.apiKey,
                        "content-type": "application/json",
                    },
                }
            )
            .then(function (response) {
                return response.data.data[0].embedding;
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

        return responce;
    }

    async gptFnChat(chatMessages: any) {
        const responce = await axios
            .post(
                "https://api.openai.com/v1/chat/completions",
                {
                    model: this.model,
                    messages: chatMessages,
                    temperature: this.temprature,
                },
                {
                    headers: {
                        Authorization: "Bearer " + this.apiKey,
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

    async gptFnTestGenerator(prompt: string): Promise<string> {
        const responce = await axios
            .post(
                "https://api.openai.com/v1/chat/completions",
                {
                    model: this.model,
                    messages: [
                        {
                            role: this.role,
                            content: prompt,
                        },
                    ],
                    temperature: this.temprature,
                },
                {
                    headers: {
                        Authorization: "Bearer " + this.apiKey,
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
