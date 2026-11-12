# pii-redactor

Example for issue #290. Uses AWS Comprehend to scrub PII out of a prompt before sending it to an LLM Endpoint.

Two flavours, pick whichever matches your code:

- `comprehend.chain(text, fn)` if you're already in async/await
- `from(prompts$).pipe(redactPii(comprehend), mergeMap(openai.chat ...))` if you have a stream of prompts

## Run it

```bash
cp .env.example .env
# fill in: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, OPENAI_API_KEY
pnpm install
pnpm start          # promise demo
pnpm run stream     # rxjs / observable demo
```

Output looks like:

```
ORIGINAL : Hi, I'm Sarah Chen (sarah.chen@acme.io). My phone is 415-555-0142 ...
REDACTED : Hi, I'm [NAME] ([EMAIL]). My phone is [PHONE] ...
LLM REPLY: Sure, here's a polite extension request you can send to your landlord ...
```

The LLM only sees the bracketed placeholders, never the raw PII.

## Public API used

```ts
import {
    AWSComprehend,
    redact$,
    redactPii,
    redactPiiText,
    redactPiiBatch,
} from "@arakoodev/edgechains.js/ai";
```

`AWSComprehend.redact(opts)` accepts:

| option | default | notes |
|---|---|---|
| `text` | - | <= 100 KB (Comprehend hard limit) |
| `languageCode` | `"en"` | any code Comprehend supports |
| `piiEntityTypes` | all | restrict to e.g. `["EMAIL", "PHONE"]` |
| `minConfidence` | `0.5` | skip entities below this score |
| `strategy` | `"char"` | `"char"`, `"type"`, or `"fixed"` |
| `redactionChar` | `"*"` | replacement char/token |

## IAM policy

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["comprehend:DetectPiiEntities", "comprehend:ContainsPiiEntities"],
    "Resource": "*"
  }]
}
```
