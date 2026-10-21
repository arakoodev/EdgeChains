# Google PaLM 2 Example for EdgeChains JS

This example demonstrates how to integrate Google PaLM 2 models (`text-bison-001`, `chat-bison-001`) into EdgeChains JS using declarative Jsonnet prompt configuration.

## Features

- **Google PaLM 2 REST Integration**: Direct lightweight integration without external heavy SDKs.
- **Jsonnet Prompt Configuration**: Prompts and secrets configured declaratively under `jsonnet/`.
- **Text & Chat Support**: Both `generateText` and `generateMessage` supported.

## Running

```bash
npm install
npm run build
npm start
```
