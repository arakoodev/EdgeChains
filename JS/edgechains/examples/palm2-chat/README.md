# PaLM 2 Chat Example

This example demonstrates how to use the Google PaLM 2 API with EdgeChains to build a simple question-answering application.

## Prerequisites

1. Obtain a Google AI Studio API key from [https://makersuite.google.com/app/apikey](https://makersuite.google.com/app/apikey)
2. Set your API key in `jsonnet/secrets.jsonnet`

## Usage

```typescript
import * as path from "path";
import { createSyncRPC } from "@arakoodev/edgechains.js";

const palm2Call = createSyncRPC(path.join(__dirname, "./lib/palm2Call.cjs"));

// Register the callback
jsonnet.javascriptCallback("palm2Call", palm2Call);

// Evaluate the jsonnet file
const result = jsonnet.evaluateFile("jsonnet/main.jsonnet");
```

## Configuration

### Jsonnet Variables

| Variable | Description |
|----------|-------------|
| `palm2_api_key` | Your Google PaLM 2 API key |
| `question` | The user question to answer |

### Model Options

The `Palm2AI` class supports the following models:
- `text-bison-001` (default)
- `text-bison-002`
- `text-bison`
- `text-unicorn-001`
- `chat-bison-001`
- `chat-bison-002`
- `chat-bison`

### Generation Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `temperature` | number | 0.7 | Controls randomness |
| `max_output_tokens` | number | 1024 | Maximum tokens to generate |
| `top_p` | number | 0.95 | Nucleus sampling parameter |
| `top_k` | number | 40 | Top-k sampling parameter |
| `candidate_count` | number | 1 | Number of candidates to generate |

## API Response Format

```json
{
  "content": "The generated response text"
}
```
