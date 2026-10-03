# AWS Comprehend PII redaction

This example redacts PII before a prompt reaches the existing EdgeChains `OpenAI` endpoint. The `chat$` wrapper returns an Observable and leaves the caller's input unchanged.

## Setup from the repository

```bash
cd JS/edgechains/arakoodev
npm install
npm run build
cd ../examples/comprehend-redaction
npm install
```

## Offline endpoint demonstration

```bash
npm run demo:offline
```

This executes the actual SDK `AwsComprehendRedactor.chat$` and existing `OpenAI.chat` class. Comprehend entities are injected for synthetic input; an Axios adapter intercepts the outgoing OpenAI request locally. Assertions check that name, email and SSN are absent from the outbound messages, the original input is unchanged, and a Comprehend error prevents the endpoint transport from being called.

The returned text is explicitly an **offline transport acknowledgement**, not a model answer. No AWS/OpenAI request or paid API use occurs. This proves the SDK chain and fail-closed boundary; it does not prove live AWS detection or live LLM behavior. The captured command output is in `offline-demo-output.txt`.

## Live AWS run

```bash
export AWS_REGION=us-east-1
npm start -- "Email Ada at ada@example.com"
```

AWS credentials use the standard SDK credential chain. An AWS run can incur provider charges. Set `OPENAI_API_KEY` (and optionally `OPENAI_ORG_ID`) to also execute the observable endpoint chain against OpenAI. Live provider execution has not been recorded for this submission.

## Redactor-only mock

```bash
MOCK_COMPREHEND=1 npm start
```

This earlier mode exercises the public redactor API with an injected client but does not run the endpoint chain. Its captured output is in `demo-output.txt`.

## Required Loom demonstration

Source issue #290 requires a working example demonstrated using loom.com. The offline endpoint demo supplies a reproducible recording path; a verified Loom share URL is still pending. A standalone terminal recording or local transcript alone does not fulfill that publishing requirement.
