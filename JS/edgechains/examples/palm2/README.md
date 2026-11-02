# Google PaLM 2 Example (Jsonnet-driven prompts)

This example shows how to call the Google PaLM 2 API through the `Palm2AI`
class from `@arakoodev/edgechains.js/ai`. All prompt templates, model names and
sampling parameters live in **Jsonnet** files (`jsonnet/main.jsonnet`), so you
can tune prompts without touching TypeScript.

It covers all three PaLM 2 capabilities:

- `generateText` → `text-bison-001`
- `chat` → `chat-bison-001`
- `generateEmbeddings` → `embedding-gecko-001`

## Installation

```bash
npm install
```

## Configuration

1. Put your PaLM 2 key in `jsonnet/secrets.jsonnet`:

    ```jsonnet
    local PALM2_API_KEY = "AIza****";
    ```

2. Edit prompt templates and parameters in `jsonnet/main.jsonnet`
   (`model`, `temperature`, `maxOutputTokens`, chat `context`, etc.).

## Usage

```bash
# topic / question / race are injected into the jsonnet templates via extVar
npm run start -- "Lineage 2" "Which classes heal the most?" "Elven"
```

### Offline / CI mode

If `jsonnet/secrets.jsonnet` still holds the placeholder `YOUR_PALM2_API_KEY`,
the example runs with deterministic **mock responses** and needs no network or
API key:

```
No PALM2 key found in jsonnet/secrets.jsonnet - running with mock responses.

generateText: [mock text response]
chat: [mock chat response]
embeddings: vector of length 3
```

## Sample output (live API)

```
Using live PaLM 2 API.

generateText: In Lineage 2, the primary healing classes are Bishop, Prophet, ...
chat: The Elven race offers Tellumadin, Sylhin, Spdroid, ...
embeddings: vector of length 768
```
