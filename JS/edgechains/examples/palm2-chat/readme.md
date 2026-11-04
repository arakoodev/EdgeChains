# PaLM 2 Chat Example

Chat with Google PaLM 2 (chat-bison) using the EdgeChains JavaScript SDK. Prompts live in Jsonnet, not TypeScript.

## Installation

```bash
npm install
```

## Configuration

Add a Google Generative Language API key in `jsonnet/secrets.jsonnet`:

```
local PALM2_API_KEY = "your-google-generative-language-api-key";
```

## Usage

1. Start the server:

    ```bash
    npm run start
    ```

2. Send a `POST` request to `http://localhost:3000/chat`.

    ```bash
    curl -X POST http://localhost:3000/chat \
      -H "Content-Type: application/json" \
      -d '{"question":"What is EdgeChains?"}'
    ```

The prompt template is in `jsonnet/main.jsonnet`. The TypeScript files only load that template and call `Palm2AI`.
