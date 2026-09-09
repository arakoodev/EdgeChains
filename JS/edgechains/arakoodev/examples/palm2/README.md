# PaLM2 example

This example keeps prompt content in `prompt.jsonnet`, matching the EdgeChains convention that prompts/config live in Jsonnet rather than being hardcoded in application code.

```ts
import { Palm2AI } from "@arakoodev/edgechains.js/ai";

const palm2 = new Palm2AI({ apiKey: process.env.PALM2_API_KEY });

// Load/evaluate examples/palm2/prompt.jsonnet with your Jsonnet tooling, then pass
// prompt.text into generateText or chat.messages/context into chat.
const textResponse = await palm2.generateText({
  prompt: prompt.text,
  model: "text-bison-001",
});
```
