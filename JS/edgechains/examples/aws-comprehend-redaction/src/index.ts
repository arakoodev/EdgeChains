import Jsonnet from "@arakoodev/jsonnet";
import { AwsComprehendRedactor } from "@arakoodev/edgechains.js/ai";
import path from "node:path";

const jsonnet = new Jsonnet();
const config = JSON.parse(
    jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/main.jsonnet"))
) as {
    languageCode: "en";
    prompt: string;
    replacementText: string;
};

async function main() {
    const redactor = new AwsComprehendRedactor({
        languageCode: config.languageCode,
        replacementText: config.replacementText,
    });

    const result = await redactor.redact(config.prompt);
    console.log(result.redactedText);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
