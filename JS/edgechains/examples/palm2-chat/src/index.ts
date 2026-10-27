import Jsonnet from "@arakoodev/jsonnet";
import { Palm2AI } from "@arakoodev/edgechains.js/ai";
import fileURLToPath from "file-uri-to-path";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jsonnet = new Jsonnet();

async function run() {
    const config = JSON.parse(
        jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/main.jsonnet"))
    );
    const palm2 = new Palm2AI({
        apiKey: process.env.GEMINI_API_KEY || "demo-key",
    });

    if (!process.env.GEMINI_API_KEY) {
        console.log(
            JSON.stringify(
                {
                    mode: "dry-run",
                    request: {
                        model: config.model,
                        prompt: config.prompt,
                        ...config.generation,
                    },
                },
                null,
                2
            )
        );
        return;
    }

    const response = await palm2.chat({
        model: config.model,
        prompt: config.prompt,
        ...config.generation,
    });
    console.log(JSON.stringify(response, null, 2));
}

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
