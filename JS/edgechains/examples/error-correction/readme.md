# Error Correction Example

Implements the error-correction loop from
["LLMs Cannot Find Reasoning Errors, But Can Correct Them"](https://arxiv.org/abs/2311.08516).

The paper's key finding: large language models are poor at *locating* the exact
step where a reasoning chain goes wrong, but remarkably good at *correcting* an
answer once asked to critique and revise it. This example wires the
`ErrorCorrectionChain` (generate -> verify -> correct loop) into an Arakoo
jsonnet native so it can be driven from a jsonnet template.

## Installation

```bash
npm install
```

## Configuration

Add your OpenAI API key in `jsonnet/secrets.jsonnet`:

```jsonnet
local OPENAI_API_KEY = "sk-****";

{
    "openai_api_key": OPENAI_API_KEY,
}
```

## Usage

1. Start the server:

    ```bash
    npm run start
    ```

2. Hit the `POST` endpoint at `http://localhost:3000/error-correction` with a
   problem and (optionally) a candidate answer to correct:

    ```bash
    curl -X POST http://localhost:3000/error-correction \
      -H 'Content-Type: application/json' \
      -d '{"problem": "What is 12 * 12 + 3?", "candidateAnswer": "140"}'
    ```

The response is the structured `ErrorCorrectionResult` (final answer, initial
answer, whether it was judged correct, iteration count, and the full
per-iteration critique/correction trace).

## How it works

- `src/lib/errorCorrection.cts` — the native handler. Constructs an
  `ErrorCorrectionChain` and runs the loop.
- `src/index.ts` — Arakoo server that registers the `errorCorrection` native via
  `jsonnet.javascriptCallback(...)` and exposes the `/error-correction` route.
- `jsonnet/main.jsonnet` — the jsonnet template that calls
  `arakoo.native("errorCorrection")(...)`.