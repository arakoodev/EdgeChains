# @arakoodev/edgechains.js

A TypeScript/JavaScript SDK for building AI applications with EdgeChains.

## Installation

```bash
npm install @arakoodev/edgechains.js
```

## Modules

### AI (`@arakoodev/edgechains.js/ai`)
LLM integrations (OpenAI, Gemini, Llama, RetellAI)

### Redactor (`@arakoodev/edgechains.js/redactor`)
AWS Comprehend PII detection and redaction utility for securing prompts.

### Vector DB (`@arakoodev/edgechains.js/vector-db`)
Supabase vector database integration.

### Document Loader (`@arakoodev/edgechains.js/document-loader`)
PDF and YouTube transcript loaders.

### Splitter (`@arakoodev/edgechains.js/splitter`)
Text splitting utilities for chunking documents.

### ArakooServer (`@arakoodev/edgechains.js/arakooserver`)
Lightweight HTTP server using Hono.

### DB (`@arakoodev/edgechains.js/db`)
PostgreSQL client wrapper.

### Scraper (`@arakoodev/edgechains.js/scraper`)
Web scraping with Cheerio and Playwright.

## PII Redactor

Detect and redact personally identifiable information (PII) from text using AWS Comprehend. Chain with LLM endpoints to ensure sensitive data doesn't reach external APIs.

```typescript
import { ComprehendPiiRedactor } from "@arakoodev/edgechains.js/redactor";

const redactor = new ComprehendPiiRedactor();

// Detect PII
const entities = await redactor.detectPiiEntities("My email is john@example.com");

// Redact PII
const result = await redactor.redact({
    text: "My name is John Smith",
    maskMode: "REPLACE_WITH_ENTITY_TYPE",
});
// result.redactedText: "My name is [NAME]"

// Chain with LLM endpoint
const safeChat = redactor.chainWith(openai.chat.bind(openai));
const response = await safeChat({ prompt: unsafePrompt });
```

### Environment Variables
- `AWS_ACCESS_KEY_ID` - AWS access key
- `AWS_SECRET_ACCESS_KEY` - AWS secret key
- `AWS_REGION` - AWS region (default: us-east-1)

### Supported PII Types
NAME, EMAIL, PHONE, SSN, CREDIT_DEBIT_CARD_NUMBER, BANK_ACCOUNT_NUMBER, ADDRESS, DATE_OF_BIRTH, DRIVER_ID, PASSPORT_NUMBER, IP_ADDRESS

### Redaction Modes
- `REPLACE_WITH_ENTITY_TYPE` - Replace with `[TYPE]` (default)
- `REDACT` - Replace with `[REDACTED]`
- `MASK_WITH_CHARACTER` - Replace with repeated character
