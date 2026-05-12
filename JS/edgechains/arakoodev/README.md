Installation

```
npm install arakoodev
```

## AWS Comprehend PII redaction

`ComprehendRedactor` can redact PII before text is passed to an LLM endpoint.

```ts
import { ComprehendRedactor, OpenAI } from "@arakoodev/edgechains.js/ai";

const redactor = new ComprehendRedactor();
const openAI = new OpenAI({});
const safeOpenAI = redactor.wrapChat(openAI);

const response = await safeOpenAI.chat({
  prompt: "Summarize Jane Doe's account notes. Email: jane@example.com",
});
```

Credentials are read from `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, optional
`AWS_SESSION_TOKEN`, and `AWS_REGION` or `AWS_DEFAULT_REGION`.
