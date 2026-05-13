import Jsonnet from "@arakoodev/jsonnet";
import { AwsComprehendRedactor } from "@arakoodev/edgechains.js/ai";
import { existsSync } from "node:fs";
import path from "node:path";

const jsonnet = new Jsonnet();
const configPath =
    [
        path.join(__dirname, "../jsonnet/main.jsonnet"),
        path.join(__dirname, "../../jsonnet/main.jsonnet"),
    ].find(existsSync) || path.join(__dirname, "../jsonnet/main.jsonnet");
const config = JSON.parse(
    jsonnet.evaluateFile(configPath)
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
