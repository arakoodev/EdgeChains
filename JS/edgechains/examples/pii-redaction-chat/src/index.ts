import { ArakooServer } from "@arakoodev/edgechains.js/arakooserver";
import { ComprehendRedactor, OpenAI } from "@arakoodev/edgechains.js";
import { Subject } from "rxjs";
import Jsonnet from "@arakoodev/jsonnet";
import path from "path";
import fileURLToPath from "file-uri-to-path";

const server = new ArakooServer();
const app = server.createApp();
const jsonnet = new Jsonnet();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.get("/", async (c: any) => {
    const userText = c.req.query("text") || "";
    // Provide external variables before evaluating the jsonnet secrets file.
    jsonnet.extString("aws_region", process.env.AWS_REGION || "us-east-1");
    jsonnet.extString("openai_api_key", process.env.OPENAI_API_KEY || "");
    const secrets = JSON.parse(
        jsonnet.evaluateFile(path.join(__dirname, "../src/jsonnet/secrets.jsonnet"))
    );

    const redactor = new ComprehendRedactor({ region: secrets.aws_region || "us-east-1" });
    const gpt = new OpenAI({
        apiKey: secrets.openai_api_key,
        model: "gpt-3.5-turbo",
        temperature: 0.7,
    });

    // Chain: prompt$ -> Comprehend PII redaction -> LLM endpoint
    const prompt$ = new Subject<string>();
    const redacted$ = redactor.redactStream(prompt$);
    const answer = await new Promise<string>((resolve, reject) => {
        redacted$.subscribe({
            next: async (redacted: string) => {
                try {
                    resolve(await gpt.chat({ prompt: redacted }));
                } catch (e) {
                    reject(e);
                }
            },
            error: reject,
        });
    });
    return c.json({ answer });
});

server.listen(3000);
