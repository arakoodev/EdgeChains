# AWS Comprehend PII Redaction Example

This example demonstrates how to use the `PIIRedaction` class from `@arakoodev/edgechains.js` to detect and redact personally identifiable information (PII) in text using AWS Comprehend.

## Setup

1. Configure AWS credentials:
   ```bash
   export AWS_ACCESS_KEY_ID=your_access_key
   export AWS_SECRET_ACCESS_KEY=your_secret_key
   export AWS_REGION=us-east-1
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the example:
   ```bash
   npm run dev
   ```

## Features Demonstrated

- **Default mode**: Replace PII entities with their type labels (e.g., `[NAME]`, `[EMAIL]`)
- **Character masking**: Replace PII characters with a mask character (e.g., `********`)
- **Filtered entity types**: Only redact specified PII types (e.g., EMAIL and PHONE only)
- **Confidence threshold**: Filter out low-confidence detections

## Supported PII Entity Types

| Category | Types |
|----------|-------|
| Financial | BANK_ACCOUNT_NUMBER, BANK_ROUTING, CREDIT_DEBIT_NUMBER, CREDIT_DEBIT_CVV, CREDIT_DEBIT_EXPIRY, PIN |
| Personal | NAME, ADDRESS, PHONE, EMAIL, AGE |
| Technical | USERNAME, PASSWORD, URL, AWS_ACCESS_KEY, AWS_SECRET_KEY, IP_ADDRESS, MAC_ADDRESS |
| National | SSN, PASSPORT_NUMBER, DRIVER_ID |
| Other | DATE_TIME |
