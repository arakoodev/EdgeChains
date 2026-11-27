# Google PaLM 2 with Jsonnet Example

This example demonstrates how to integrate and use the Google PaLM 2 API (`text-bison-001`) with EdgeChains and Jsonnet prompt templates.

## Prerequisites

Set your Google PaLM 2 API key in the environment:

```bash
export PALM2_API_KEY="your-api-key"
```

## Running the Example

1. Install dependencies:

```bash
npm install
```

2. Start the server:

```bash
npm start
```

3. Query the chat endpoint:

```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"question": "Explain quantum computing in one sentence."}'
```
