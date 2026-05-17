# AWS Comprehend Redaction

This example shows how to use `ComprehendRedactor` to replace PII spans returned by AWS Comprehend.

```ts
import { ComprehendRedactor } from "@arakoodev/edgechains.js/ai";
import { ComprehendClient, DetectPiiEntitiesCommand } from "@aws-sdk/client-comprehend";

const redactor = new ComprehendRedactor({
    client: new ComprehendClient({ region: "us-east-1" }),
    commandConstructor: DetectPiiEntitiesCommand,
});

const result = await redactor.redactText("Jane Smith uses jane@example.com.");

console.log(result.text);
```

The utility also accepts a custom detector function, which is useful in tests or in a Jsonnet native bridge.
