const { TextServiceClient } = require("@google-ai/generativelanguage");
const { GoogleAuth } = require("google-auth-library");

export class Palm2AiEndpoint {
    apiKey
    model;
    temperature;
    constructor(apiKey, model, temperature) {
        this.model = model;
        this.temperature = temperature;
        this.client = new TextServiceClient({
            authClient: new GoogleAuth().fromAPIKey(apiKey),
        });
    }

    async chatFun(promptText) {
        return this.client.generateText({
            model: this.model,
            temperature: 0.7,
            prompt: {
                text: promptText,
            },
        }).then(result => {
            // Process the result and return the output
            const outputs = result.flatMap(d1 => d1?.candidates?.map(d2 => d2.output)).filter(output => output);
            return outputs.length > 0 ? outputs[0].split(" ").join("") : undefined;
        }).catch(error => {
            if (error.response) {
                console.log("Server responded with status code:", error.response.status);
                console.log("Response data:", error.response.data);
            } else if (error.request) {
                console.log("No response received:", error.request);
            } else {
                console.log("Error creating request:", error.message);
            }
        });
    }
}