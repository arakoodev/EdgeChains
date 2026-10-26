import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Palm2Endpoint } from "../../src/ai/src/lib/palm2/palm2.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Loads prompt definitions from `palm2.jsonnet` and executes Google PaLM 2
 * text generation, multi-turn chat, and embedding calls via `Palm2Endpoint`.
 */
export async function runPalm2Example(apiKey = process.env.PALM2_API_KEY || "") {
    const configPath = path.join(__dirname, "palm2.jsonnet");
    const jsonnetConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));

    const palm2 = new Palm2Endpoint({
        apiKey,
        defaultChatModel: jsonnetConfig.model,
        defaultTextModel: jsonnetConfig.textModel,
        defaultEmbeddingModel: jsonnetConfig.embeddingModel,
    });

    const textResult = await palm2.generateText({
        prompt: jsonnetConfig.textPrompt,
        temperature: jsonnetConfig.temperature,
        maxOutputTokens: jsonnetConfig.maxOutputTokens,
    });

    const chatResult = await palm2.chat({
        context: jsonnetConfig.context,
        messages: jsonnetConfig.messages,
        temperature: jsonnetConfig.temperature,
    });

    const embeddingResult = await palm2.generateEmbeddings({
        text: jsonnetConfig.embeddingText,
    });

    return {
        textResult,
        chatResult,
        embeddingResult,
    };
}
