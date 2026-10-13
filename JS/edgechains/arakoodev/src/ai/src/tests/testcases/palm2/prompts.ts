import path from "path";

// Loads the palm2 testcase prompts from prompts.jsonnet so no prompts are
// hardcoded in the test sources.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Jsonnet = require("@arakoodev/jsonnet");

export interface Palm2TestPrompts {
  text_prompt: string;
  text_prompt_with_options: string;
  chat_messages: { content: string; author: "user" | "assistant" | "system" }[];
}

let cached: Palm2TestPrompts | null = null;

export function loadPrompts(): Palm2TestPrompts {
  if (!cached) {
    const jsonnet = new Jsonnet();
    const evaluated = jsonnet.evaluateFile(
      path.join(__dirname, "prompts.jsonnet"),
    );
    cached = JSON.parse(evaluated) as Palm2TestPrompts;
  }
  return cached;
}
