# Redact PII with Amazon Comprehend

Strip personally identifiable information (PII) out of a user prompt with
[Amazon Comprehend](https://docs.aws.amazon.com/comprehend/latest/dg/how-pii.html)
before chaining it into an LLM endpoint such as `OpenAI`.

```ts
import { Comprehend } from "@arakoodev/edgechains.js/comprehend";
import { OpenAI } from "@arakoodev/edgechains.js/ai";

const comprehend = new Comprehend();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const safePrompt = await comprehend.redact("My email is jane@doe.com");
// -> "My email is [EMAIL]"

const answer = await openai.chat({ prompt: safePrompt });
```

## Run

```bash
npm install
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export AWS_REGION=us-east-1
export OPENAI_API_KEY=...
npm start
```

## API

### `new Comprehend(options?)`

| option            | env fallback            | default       |
| ----------------- | ----------------------- | ------------- |
| `accessKeyId`     | `AWS_ACCESS_KEY_ID`     | —             |
| `secretAccessKey` | `AWS_SECRET_ACCESS_KEY` | —             |
| `region`          | `AWS_REGION`            | `us-east-1`   |

### `comprehend.redact(text, { languageCode?, mask? })`

Detects PII and returns a redacted copy of `text`. Each entity is replaced by
`mask(type)` (default `[TYPE]`, e.g. `[EMAIL]`).

### `comprehend.detectPii(text, languageCode?)`

Returns the raw `PiiEntity[]` Amazon Comprehend reports.
