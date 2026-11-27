# AWS Comprehend PII Redaction Example

This example demonstrates how to use AWS Comprehend to detect and redact Personally Identifiable Information (PII) in text before sending it to AI models.

## Features

- ✅ Detect PII entities in text (names, emails, phone numbers, SSN, etc.)
- ✅ Redact PII with customizable redaction characters
- ✅ Chain with existing AI endpoints (OpenAI, Gemini, etc.)
- ✅ Middleware pattern for automatic redaction
- ✅ Batch processing support
- ✅ TypeScript support with full type definitions

## Prerequisites

1. AWS Account with Comprehend access
2. AWS credentials (Access Key ID and Secret Access Key)
3. (Optional) OpenAI API key for AI integration examples

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file:
```env
# AWS Credentials
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here

# Optional: For AI integration examples
OPENAI_API_KEY=your_openai_key_here
```

3. Run the examples:
```bash
npm start
```

## Examples

### Example 1: Basic PII Detection

Detect PII entities in text:

```typescript
const comprehend = new AWSComprehend();
const text = "My name is John Doe, email: john@example.com";

const result = await comprehend.detectPii({ text });
console.log(result.containsPii); // true
console.log(result.entities); // [{ type: 'NAME', ... }, { type: 'EMAIL', ... }]
```

### Example 2: PII Redaction

Redact PII from text:

```typescript
const comprehend = new AWSComprehend();
const text = "Contact Jane at jane@company.com or 555-1234";

const result = await comprehend.redact({ text });
console.log(result.redactedText); 
// "Contact **** at ******************* or ********"
```

### Example 3: Custom Redaction Character

Use custom redaction character:

```typescript
const result = await comprehend.redact({ 
    text: "My SSN is 123-45-6789",
    redactionChar: "X"
});
console.log(result.redactedText); // "My SSN is XXXXXXXXXXX"
```

### Example 4: Chaining with OpenAI

Automatically redact PII before sending to AI:

```typescript
const comprehend = new AWSComprehend();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const userPrompt = "Hi, I'm Sarah (sarah@email.com). Help me!";

const aiResponse = await comprehend.chain(
    userPrompt,
    async (redactedPrompt) => {
        return await openai.chat({
            prompt: redactedPrompt,
            model: "gpt-3.5-turbo",
        });
    }
);
```

### Example 5: Using Middleware

Create reusable redaction middleware:

```typescript
const middleware = createRedactionMiddleware();

const result = await middleware.execute(
    "My SSN is 123-45-6789",
    async (redactedPrompt) => {
        return await openai.chat({ prompt: redactedPrompt });
    }
);

console.log(result.result); // AI response
console.log(result.redactionInfo); // Redaction details
```

### Example 6: Wrapped Endpoint

Wrap an endpoint for automatic redaction:

```typescript
const middleware = createRedactionMiddleware();

const chatEndpoint = async (prompt: string) => {
    return await openai.chat({ prompt });
};

// Wrap it - now it automatically redacts PII
const secureChat = middleware.wrap(chatEndpoint);

const response = await secureChat("Hi, I'm Alice (alice@company.com)");
```

### Example 7: Batch Redaction

Process multiple texts at once:

```typescript
const texts = [
    "Contact John at john@example.com",
    "Call Jane at 555-1234",
    "SSN: 123-45-6789",
];

const results = await comprehend.redactBatch(texts);
results.forEach(result => {
    console.log(result.redactedText);
});
```

## API Reference

### AWSComprehend

Main class for PII detection and redaction.

#### Constructor

```typescript
new AWSComprehend(options?: {
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
})
```

#### Methods

- `detectPii(options)` - Detect PII entities
- `redact(options)` - Redact PII from text
- `containsPii(options)` - Quick check if text contains PII
- `chain(text, next, options?)` - Chain with next function
- `redactBatch(texts, options?)` - Batch redact multiple texts

### RedactionMiddleware

Middleware for automatic PII redaction.

#### Methods

- `execute(prompt, endpointCall, options?)` - Execute with redaction
- `wrap(endpoint)` - Wrap endpoint for automatic redaction

### createRedactionMiddleware

Factory function to create middleware:

```typescript
createRedactionMiddleware(
    comprehendOptions?,
    defaultRedactOptions?
)
```

## Supported PII Types

AWS Comprehend can detect and redact:

- Names (NAME)
- Email addresses (EMAIL)
- Phone numbers (PHONE)
- Social Security Numbers (SSN)
- Credit card numbers (CREDIT_DEBIT_NUMBER)
- Bank account numbers (BANK_ACCOUNT_NUMBER)
- Addresses (ADDRESS)
- Dates of birth (DATE_TIME)
- And more...

## Security Best Practices

1. **Never log original prompts** containing PII
2. **Always redact before sending** to external APIs
3. **Store AWS credentials securely** (use environment variables)
4. **Monitor redaction logs** for compliance
5. **Test with sample PII** before production use

## Troubleshooting

### AWS Credentials Not Found

Make sure your `.env` file contains:
```env
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=us-east-1
```

### Comprehend API Errors

- Check your AWS IAM permissions include `comprehend:DetectPiiEntities`
- Verify your AWS region supports Comprehend
- Check AWS service quotas

### TypeScript Errors

Make sure you have the correct types installed:
```bash
npm install --save-dev @types/node
```

## Demo Video

[Link to Loom demo video will be added here]

## License

MIT

## Contributing

Pull requests are welcome! Please ensure:
- All tests pass
- Code follows existing style
- Documentation is updated
