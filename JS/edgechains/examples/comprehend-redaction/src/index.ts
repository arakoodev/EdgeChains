import { ComprehendRedactor } from "@arakoodev/edgechains.js/ai";

const redactor = new ComprehendRedactor();
const downstreamEndpoint = async (prompt: string): Promise<string> => {
    console.log("Protected prompt:", prompt);
    return prompt;
};

await redactor.protect(
    "Please send the result to customer@example.com.",
    downstreamEndpoint,
    { types: ["EMAIL"] }
);
