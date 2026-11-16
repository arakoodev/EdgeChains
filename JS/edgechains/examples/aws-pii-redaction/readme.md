# AWS PII Redaction Example

This example demonstrates how to use the `AwsComprehend` utility within EdgeChains to detect and redact Personally Identifiable Information (PII) from text.

## How it works

1.  **Jsonnet**: The prompt/text management is handled via `jsonnet/main.jsonnet`.
2.  **Worker**: A sync RPC worker (`awsRedact.cts`) calls the `AwsComprehend` class.
3.  **Server**: The main server (`src/index.ts`) exposes a `/redact` endpoint.

## Setup

1.  Set your AWS credentials in `.env`:
    ```env
    AWS_REGION=us-east-1
    AWS_ACCESS_KEY_ID=your_access_key
    AWS_SECRET_ACCESS_KEY=your_secret_key
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Run the example:
    ```bash
    npm start
    ```

## Usage

Send a POST request to `http://localhost:3000/redact`:

```json
{
  "text": "Hello, my name is John Doe and my email is john@example.com"
}
```

Response:
```json
{
  "redactedText": "Hello, my name is [NAME] and my email is [EMAIL]"
}
```
