import { ComprehendPiiRedactor, type ComprehendClientLike } from "@arakoodev/edgechains.js/ai";
import { firstValueFrom, of } from "rxjs";

const prompt = "🔒 Contact jane@example.com before sharing this prompt.";
const email = "jane@example.com";
const start = Array.from(prompt.slice(0, prompt.indexOf(email))).length;
const offlineClient: ComprehendClientLike = {
    async send() {
        return {
            $metadata: {},
            Entities: [
                {
                    Type: "EMAIL",
                    Score: 0.999,
                    BeginOffset: start,
                    EndOffset: start + Array.from(email).length,
                },
            ],
        };
    },
};

const redactor = new ComprehendPiiRedactor({
    client: process.env.USE_REAL_AWS === "true" ? undefined : offlineClient,
    region: process.env.AWS_REGION || "us-east-1",
});
const endpoint = {
    async chat(options: { prompt: string }) {
        return `Endpoint received: ${options.prompt}`;
    },
};

console.log("Original:", prompt);
console.log(await firstValueFrom(of({ prompt }).pipe(redactor.endpointOperator(endpoint))));
