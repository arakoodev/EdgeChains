Installation

```
npm install arakoodev
```

## AWS Comprehend PII redaction

`AwsComprehendRedactor` wraps AWS Comprehend `DetectPiiEntities` and returns redacted text plus the detected entity metadata. It accepts either an AWS SDK v2-style client with `detectPiiEntities()` or an AWS SDK v3-style client with `send()` and a command factory.

```ts
import { ComprehendClient, DetectPiiEntitiesCommand } from "@aws-sdk/client-comprehend";
import { AwsComprehendRedactor } from "@arakoodev/edgechains.js/ai";

const redactor = new AwsComprehendRedactor({
    client: new ComprehendClient({ region: "us-east-1" }),
    commandFactory: DetectPiiEntitiesCommand,
    minScore: 0.9,
});

const result = await redactor.redact("Jane can be reached at jane@example.com");
console.log(result.redactedText); // [NAME_REDACTED] can be reached at [EMAIL_REDACTED]
```

Options include `languageCode`, `minScore`, `entityTypes`, and a static or callback `replacement` for custom redaction tokens.
