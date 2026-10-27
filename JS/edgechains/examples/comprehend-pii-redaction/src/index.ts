import { AwsComprehendPiiRedactor, OpenAI } from "@arakoodev/edgechains.js/ai";
import Jsonnet from "@arakoodev/jsonnet";
import path from "path";
import fileURLToPath from "file-uri-to-path";

const jsonnet = new Jsonnet();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function runRedactedPrompt(rawMessage: string) {
    const redactor = new AwsComprehendPiiRedactor({
        region: process.env.AWS_REGION || "us-east-1",
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    });

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });

    return await redactor
        .chain(rawMessage, async (cleanMessage) => {
            jsonnet.extString("redacted_message", cleanMessage);
            const prompt = jsonnet.evaluateFile(
                path.join(__dirname, "../jsonnet/main.jsonnet")
            );
            return await openai.chat({ prompt });
        })
        .run();
}
