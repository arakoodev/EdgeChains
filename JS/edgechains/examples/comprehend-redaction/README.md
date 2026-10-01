# AWS Comprehend PII redaction

This example redacts PII with Amazon Comprehend before a prompt is sent to an EdgeChains endpoint.

## Live AWS run

```bash
npm install
export AWS_REGION=us-east-1
npm start -- "Email Ada at ada@example.com"
```

AWS credentials use the standard SDK credential chain. Set `OPENAI_API_KEY` (and optionally `OPENAI_ORG_ID`) to also demonstrate the observable `redactor.chat$(endpoint, options)` chain.

## Credential-free demo

```bash
MOCK_COMPREHEND=1 npm start
```

The mock mode uses the same public redactor API with an injected Comprehend-compatible client. It exists for repeatable local/CI verification and does not make billable API calls. A captured run is in `demo-output.txt`.
