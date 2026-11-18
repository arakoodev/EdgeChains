import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface Palm2TestPrompts {
    text_prompt: string;
    text_prompt_with_options: string;
    chat_messages: { content: string; author: "user" | "assistant" | "system" }[];
}

let cached: Palm2TestPrompts | null = null;

export function loadPrompts(): Palm2TestPrompts {
    if (!cached) {
        const filePath = path.join(__dirname, "prompts.jsonnet");
        const raw = fs.readFileSync(filePath, "utf-8");
        // Strip Jsonnet comments
        const sanitized = raw.replace(/\/\/.*$/gm, "").replace(/^\s*#.*$/gm, "").replace(/,\s*([}\]])/g, "$1");
        cached = JSON.parse(sanitized) as Palm2TestPrompts;
    }
    return cached;
}
