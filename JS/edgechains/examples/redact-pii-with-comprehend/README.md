# Redact PII with Amazon Comprehend

This runnable example sends a prompt through `ComprehendRedactor`'s RxJS operator before it is passed to an existing EdgeChains `OpenAI` endpoint. Comprehend returns PII offsets; the utility replaces those ranges with a configurable placeholder.

## Run

Set AWS credentials with the standard AWS credential-provider chain, then set `OPENAI_API_KEY` and optionally `AWS_REGION` (default: `us-east-1`). From this directory run:

```sh
npm install
npm start
```

The pipeline is the important part:

```ts
from([{ prompt: incomingPrompt }]).pipe(
  redactor.redactChatOptionsOperator(),
  concatMap((safeOptions) => from(openAI.chat(safeOptions)))
)
```

`redactChatOptionsOperator()` redacts both `prompt` and every string `messages[].content`, retaining the stream order. For code that is not already RxJS-based, use `await redactor.chat(openAI, options)` to redact immediately before calling an endpoint.
