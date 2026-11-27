import path from "path";
import { Palm2AI, loadJsonnetPrompts } from "../../../arakoodev/src/ai/src/index.js";

export async function runPalm2JsonnetExample() {
    const jsonnetConfig = loadJsonnetPrompts(
        path.join(__dirname, "../jsonnet/main.jsonnet")
    );

    const palm2 = new Palm2AI({
        apiKey: process.env.PALM2_API_KEY,
    });

    const textCompletion = await palm2.generateText({
        model: jsonnetConfig.model,
        prompt: jsonnetConfig.summaryPrompt,
    });

    const chatReply = await palm2.chat({
        model: jsonnetConfig.chatModel,
        context: jsonnetConfig.systemContext,
        messages: [{ author: "user", content: jsonnetConfig.chatMessage }],
    });

    const embedding = await palm2.generateEmbeddings({
        model: jsonnetConfig.embeddingModel,
        text: jsonnetConfig.embeddingInput,
    });

    return { textCompletion, chatReply, embedding };
}
