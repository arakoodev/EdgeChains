import axios from "axios";
import { retry } from "@lifeomic/attempt";
const url = "https://generativelanguage.googleapis.com/v1beta/models/text-bison-001:generateText";

interface Palm2ConstructionOptions {
    apiKey?: string;
}

type SafetyRating = {
    category:
        | "HARM_CATEGORY_SEXUALLY_EXPLICIT"
        | "HARM_CATEGORY_HATE_SPEECH"
        | "HARM_CATEGORY_HARASSMENT"
        | "HARM_CATEGORY_DANGEROUS_CONTENT";
    probability: "NEGLIGIBLE" | "LOW" | "MEDIUM" | "HIGH";
};

type Candidate = {
    output: string;
    safetyRatings: SafetyRating[];
};

type Response = {
    candidates: Candidate[];
};

interface Palm2ChatOptions {
    model?: string;
    max_output_tokens?: number;
    temperature?: number;
    prompt: string;
    max_retry?: number;
    delay?: number;
}

export class Palm2AI {
    apiKey: string;
    constructor(options: Palm2ConstructionOptions) {
        this.apiKey = options.apiKey || process.env.PALM2_API_KEY || process.env.GOOGLE_API_KEY || "";
    }

    async chat(chatOptions: Palm2ChatOptions): Promise<Response> {
        let data = JSON.stringify({
            prompt: {
                text: chatOptions.prompt,
            },
            temperature: chatOptions.temperature || 0.7,
            candidateCount: 1,
            maxOutputTokens: chatOptions.max_output_tokens || 1024,
        });

        let config = {
            method: "post",
            maxBodyLength: Infinity,
            url: url.replace("text-bison-001", chatOptions.model || "text-bison-001"),
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": this.apiKey,
            },
            data: data,
        };
        return await retry(
            async () => {
                return (await axios.request(config)).data;
            },
            { maxAttempts: chatOptions.max_retry || 3, delay: chatOptions.delay || 200 }
        );
    }
}
