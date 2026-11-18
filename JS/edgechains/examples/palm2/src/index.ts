import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PaLM2Client } from "@arakoodev/edgechains.js/ai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadJsonnetConfig(filePath: string): any {
    const raw = fs.readFileSync(filePath, "utf-8");
    const sanitized = raw.replace(/\/\/.*$/gm, "").replace(/^\s*#.*$/gm, "").replace(/,\s*([}\]])/g, "$1");
    return JSON.parse(sanitized);
}

async function main() {
    const secrets = loadJsonnetConfig(path.resolve(__dirname, "../jsonnet/secrets.jsonnet"));
    const promptConfig = loadJsonnetConfig(path.resolve(__dirname, "../jsonnet/main.jsonnet"));

    const apiKey = process.env.PALM_API_KEY || secrets.palm_api_key;
    const client = new PaLM2Client({ apiKey });

    console.log("Loaded Prompt from main.jsonnet:", promptConfig.prompt);

    if (process.env.PALM_API_KEY) {
        const response = await client.generateText(promptConfig.prompt, {
            model: promptConfig.model,
            temperature: promptConfig.temperature,
            maxOutputTokens: promptConfig.maxOutputTokens,
        });
        console.log("PaLM 2 Output:", response.candidates?.[0]?.output);
    } else {
        console.log("(Dry run completed successfully. Set PALM_API_KEY to send real API requests.)");
    }
}

main().catch(console.error);
