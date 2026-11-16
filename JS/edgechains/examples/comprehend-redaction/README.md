# AWS Comprehend PII redaction

This example detects Spanish personal information using AWS Comprehend and
forwards only the redacted prompt to a demonstration chat endpoint.
AWS receives the original text for detection. No LLM API is called.

Install the package dependencies in `../../arakoodev`, configure the AWS default
credential chain with `comprehend:DetectPiiEntities` permission, and set
`AWS_REGION`. Compile this example with TypeScript and run the generated JS.
Only run the live example with an authorized AWS account; AWS usage may incur charges.

For a local fixture-only demo requiring no credentials, run from repository root:

```sh
node JS/edgechains/arakoodev/src/ai/src/tests/comprehend.demo.mjs
```

The fixture demo validates composition and replacement, not real AWS detection.
To use a real chat endpoint, pass an existing `OpenAI` or compatible instance to
`redactor.next(endpoint)`.

The detector supports `en` and `es`. Requests over 100,000 UTF-8 bytes are rejected
before sending. Splitting automatically could miss personal information across
chunk boundaries. Service failures and invalid offsets stop downstream calls.

## Local demonstration video

[Watch the 15-second local mock demonstration](demo/local-demo.mp4).

This visual summary uses actual output captured from the local fixture demo.
It is not a live AWS recording or a Loom upload. [Execution transcript](demo/execution.txt).
The test suite now has 15 passing tests, including default AWS adapter requests
with the SDK transport mocked.
