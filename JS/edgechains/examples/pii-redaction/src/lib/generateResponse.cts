const { OpenAI } = require("@arakoodev/edgechains.js/ai");
const { AwsComprehendPIIRedactor } = require("@arakoodev/edgechains.js/pii-redactor");
const { lastValueFrom, from } = require("rxjs");
import { z } from "zod";

const schema = z.object({
    answer: z.string().describe("The answer to the question"),
});

async function openAICall({ prompt, openAIApiKey }: any) {
    try {
        // Will use local AWS credentials provided by the host machine
        const awsConfig = { region: "us-east-1" }; 
        const redactor = new AwsComprehendPIIRedactor(awsConfig);
        const openai = new OpenAI({ apiKey: openAIApiKey });
        
        // Chaining the Prompt through the Redaction Observable middleware pipe
        const safePromptStream$ = from([prompt]).pipe(
            redactor.createRedactionOperator("en")
        );
        
        // Resolving the observable to pass to OpenAI endpoint
        const safePrompt = await lastValueFrom(safePromptStream$);
        
        let res = await openai.zodSchemaResponse({ prompt: safePrompt, schema: schema });
        
        // Returning the redacted prompt text in JSON to visually prove execution for the demo
        return JSON.stringify({
            original_prompt_received_by_llm: safePrompt,
            answer: res
        });
    } catch (error) {
        return error;
    }
}

module.exports = openAICall;
