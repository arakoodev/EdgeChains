# AWS Comprehend Redaction Example

This example reads a prompt from Jsonnet, detects PII with AWS Comprehend, and prints prompt options that can be passed to an LLM endpoint after redaction.

## Installation

```bash
npm install
```

## Configuration

Add AWS credentials to `jsonnet/secrets.jsonnet`, or leave them as placeholders and use the default AWS credential chain from your environment.

```jsonnet
{
    aws_access_key_id: "YOUR_AWS_ACCESS_KEY_ID",
    aws_region: "us-east-1",
    aws_secret_access_key: "YOUR_AWS_SECRET_ACCESS_KEY",
    aws_session_token: "",
}
```

## Usage

```bash
npm run start
```

The prompt lives in `jsonnet/main.jsonnet` so the example does not hardcode prompt text in TypeScript.

The `AWSComprehend` class can also be chained before existing endpoint calls:

```ts
const safeChatOptions = await comprehend.redactPromptOptions({
    prompt: rawPrompt,
    temperature: 0.2,
});

await openai.chat(safeChatOptions);
```
