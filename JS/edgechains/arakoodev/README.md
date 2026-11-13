Installation

```
npm install arakoodev
```

# aws-comprehend

The `aws-comprehend` module redacts personally identifiable information (PII)
from prompts with Amazon Comprehend. Detected entities (names, emails, phone
numbers, SSNs, addresses, credit card numbers, and more) are replaced with
masks such as `[EMAIL]` before the text is forwarded to an LLM endpoint.

```ts
import { OpenAI } from "@arakoodev/edgechains.js/ai";
import {
    ComprehendPiiRedactor,
    RedactionObservable,
} from "@arakoodev/edgechains.js/aws-comprehend";
import { of } from "rxjs";
import { mergeMap } from "rxjs/operators";

const redactor = new ComprehendPiiRedactor({
    region: "us-east-1",
});

// Standalone use
const redacted = await redactor.redact(
    "Jane Smith can be reached at jane.doe@example.com."
);
// "[NAME] can be reached at [EMAIL]."

// Chained with an endpoint class as observables
const openai = new OpenAI();
const completion$ = new RedactionObservable(
    of("Jane Smith can be reached at jane.doe@example.com."),
    redactor
).pipe(mergeMap((prompt) => openai.chat({ prompt })));

completion$.subscribe((response) => console.log(response.content));
```

Options:

- `redact(text, options)` masks every detected entity. Options control the
  `mask` template (default `"[{type}]"`), `entityTypes` to redact, the
  minimum confidence `minScore`, and the document `language` (default `en`).
  Overlapping entities are resolved by keeping the longest span.
- `detect(text, options)` returns the entities with offsets relative to the
  whole document. Documents larger than the synchronous API limit
  (100 KB UTF-8) are transparently split into chunks.
- `RedactionObservable` accepts a plain string or any `Observable<string>`
  and emits redacted values; `get()` returns the redacted string as a
  promise. Any `PiiRedactor` implementation can be injected, so unit tests
  and non-AWS environments can substitute their own detector:

```ts
const redactor = new ComprehendPiiRedactor({
    client: {
        send: async (command) => ({ Entities: [...] }),
    },
});
```

Credentials are read from the standard AWS credential chain by default, or
passed explicitly through `accessKeyId`, `secretAccessKey`, and `sessionToken`.

A runnable example lives in
[examples/pii-redaction-aws-comprehend](../examples/pii-redaction-aws-comprehend/readme.md).
