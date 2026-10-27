# PaLM2/Gemini chat example

This example keeps the prompt and model configuration in `jsonnet/main.jsonnet`
and calls the Google Generative Language API through `Palm2AI`.

## Run

```sh
export GOOGLE_API_KEY=...
bun install
bun run start
```

Change the prompt topic without editing TypeScript:

```sh
TOPIC="agentic workflows" bun run start
```
