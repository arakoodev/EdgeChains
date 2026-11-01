# EdgeChains Google PaLM 2 Example

This example demonstrates how to integrate and use the Google PaLM 2 API with EdgeChains.js.

## Supported Capabilities

- **Text Generation:** Using `text-bison-001` with temperature, token limits, and safety settings.
- **Multi-turn Chat:** Using `chat-bison-001` with context and message history.
- **Semantic Embeddings:** Using `embedding-gecko-001` to generate dense vector embeddings.

## Prerequisites

Set your Google PaLM API key in environment or `.env`:

```bash
export PALM2_API_KEY="your-google-palm2-api-key"
```

## Running the Example

```bash
npm install
npm run build
npm start
```
