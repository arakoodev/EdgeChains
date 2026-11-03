# Redact PII Example

Redact personally identifiable information (PII) from a prompt using AWS
Comprehend before it reaches an LLM.

## Setup

1. Install dependencies:

    ```bash
    npm install
    ```

2. Set AWS credentials in your environment:

    ```bash
    export AWS_REGION=us-east-1
    export AWS_ACCESS_KEY_ID=...
    export AWS_SECRET_ACCESS_KEY=...
    ```

## Run

```bash
npm run start
```

The script detects and redacts PII such as names, email addresses, and phone
numbers from a sample prompt.
