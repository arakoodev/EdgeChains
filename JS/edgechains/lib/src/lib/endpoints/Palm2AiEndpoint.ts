import { TextServiceClient } from "@google-ai/generativelanguage";
import { GoogleAuth } from "google-auth-library";

export class Palm2AiEndpoint {
    apiKey: string;
    model: string;
    temperature: number;
    client: any; // Adjust the type as needed

    constructor(apiKey: string, model: string, temperature: number) {
        this.apiKey = apiKey;
        this.model = model;
        this.temperature = temperature;
        this.client = new TextServiceClient({
            authClient: new GoogleAuth().fromAPIKey(apiKey),
        });
    }

    async chatFun(promptText: string): Promise<string | undefined> {
        try {
            const result = await this.client.generateText({
                model: this.model,
                temperature: 0.7,
                prompt: {
                    text: promptText,
                },
            });

            // Process the result and return the output
            const outputs = result.flatMap((d1: any) => d1?.candidates?.map((d2: any) => d2.output)).filter((output: string) => output);
            return outputs.length > 0 ? outputs[0].split(" ").join("") : undefined;
        } catch (error: any) {
            if (error.response) {
                console.log("Server responded with status code:", error.response.status);
                console.log("Response data:", error.response.data);
            } else if (error.request) {
                console.log("No response received:", error.request);
            } else {
                console.log("Error creating request:", error.message);
            }
            return undefined;
        }
    }
}
