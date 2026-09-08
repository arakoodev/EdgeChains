# AWS Comprehend PII redaction example

Redact personally identifiable information (PII) from prompts with AWS Comprehend before chaining them into an OpenAI endpoint call.

## Setup

1. Provide AWS credentials in a `.env` file (or via your AWS credential chain):

```
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
OPENAI_API_KEY=...
```

2. Install dependencies:

```
npm install
```

3. Run the example:

```
npm start
```

The example prints the redacted prompt (PII replaced with entity type markers like `[NAME]` and `[EMAIL]`) and then the OpenAI chat response.
