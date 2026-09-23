import "dotenv/config";
import Jsonnet from "@arakoodev/jsonnet";
import { ComprehendRedactor } from "@arakoodev/edgechains.js/ai";
import fileURLToPath from "file-uri-to-path";
import path from "path";
import { firstValueFrom, of } from "rxjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const prompt =
    process.argv.slice(2).join(" ") ||
    "Customer Jane Smith emailed jane@example.com and asked about invoice 12345.";

const redactor = new ComprehendRedactor({
    region: process.env.AWS_REGION || "us-east-1",
});

const result = await firstValueFrom(
    redactor.redactPrompt$(of(prompt), {
        minScore: 0.75,
    }),
);

const jsonnet = new Jsonnet();
jsonnet.extString("redacted_prompt", result.redactedText);

const compiledPrompt = JSON.parse(
    jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/main.jsonnet")),
);

console.log(
    JSON.stringify(
        {
            redactedPrompt: result.redactedText,
            entities: result.entities.map(
                ({ type, score, beginOffset, endOffset }) => ({
                    type,
                    score,
                    beginOffset,
                    endOffset,
                }),
            ),
            compiledPrompt: compiledPrompt.prompt,
        },
        null,
        2,
    ),
);
