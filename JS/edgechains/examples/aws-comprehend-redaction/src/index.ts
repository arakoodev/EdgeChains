import { AWSComprehend } from "@arakoodev/edgechains.js/ai";
import Jsonnet from "@arakoodev/jsonnet";
import fileURLToPath from "file-uri-to-path";
import path from "path";

const jsonnet = new Jsonnet();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

type Secrets = {
    aws_access_key_id?: string;
    aws_region?: string;
    aws_secret_access_key?: string;
    aws_session_token?: string;
};

type PromptConfig = {
    language_code?: "en" | "es" | "fr" | "de" | "it" | "pt" | "ar" | "hi" | "ja" | "ko" | "zh" | "zh-TW";
    prompt: string;
};

function readJsonnet<T>(filePath: string): T {
    return JSON.parse(jsonnet.evaluateFile(filePath));
}

function buildCredentials(secrets: Secrets) {
    if (
        !secrets.aws_access_key_id ||
        !secrets.aws_secret_access_key ||
        secrets.aws_access_key_id.startsWith("YOUR_")
    ) {
        return undefined;
    }

    return {
        accessKeyId: secrets.aws_access_key_id,
        secretAccessKey: secrets.aws_secret_access_key,
        sessionToken: secrets.aws_session_token || undefined,
    };
}

async function main() {
    const promptConfig = readJsonnet<PromptConfig>(
        path.join(__dirname, "../jsonnet/main.jsonnet")
    );
    const secrets = readJsonnet<Secrets>(path.join(__dirname, "../jsonnet/secrets.jsonnet"));
    const credentials = buildCredentials(secrets);

    const redactor = new AWSComprehend({
        accessKeyId: credentials?.accessKeyId,
        languageCode: promptConfig.language_code || "en",
        region: secrets.aws_region,
        secretAccessKey: credentials?.secretAccessKey,
        sessionToken: credentials?.sessionToken,
    });

    const result = await redactor.redactPromptOptions({
        prompt: promptConfig.prompt,
    });

    console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
