# AWS Comprehend Integration

This module provides integration with AWS Comprehend for PII (Personally Identifiable Information) detection and redaction.

## Installation

Make sure you have the AWS SDK installed:

```bash
npm install @aws-sdk/client-comprehend
```

## Setup

Set up your AWS credentials:

### Option 1: Environment Variables

```bash
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export AWS_REGION=us-east-1
```

### Option 2: Pass credentials to constructor

```typescript
import { Comprehend } from "@arakoodev/edgechains.js/ai";

const comprehend = new Comprehend({
    accessKeyId: "your_access_key",
    secretAccessKey: "your_secret_key",
    region: "us-east-1"
});
```

## Usage

### Detect PII Entities

```typescript
import { Comprehend } from "@arakoodev/edgechains.js/ai";

const comprehend = new Comprehend();

const text = "Hello, my name is John Doe and my phone number is 555-123-4567. My email is john.doe@example.com.";

const result = await comprehend.detectPiiEntities({
    text: text,
    languageCode: "en"
});

console.log("Detected PII entities:", result.Entities);
// Output:
// [
//   { Type: "NAME", Score: 0.99, BeginOffset: 17, EndOffset: 25 },
//   { Type: "PHONE", Score: 0.98, BeginOffset: 52, EndOffset: 64 },
//   { Type: "EMAIL", Score: 0.99, BeginOffset: 76, EndOffset: 94 }
// ]
```

### Redact PII with Entity Type Replacement

```typescript
const comprehend = new Comprehend();

const text = "Hello, my name is John Doe and my phone number is 555-123-4567.";

const result = await comprehend.redactPii({
    text: text,
    maskMode: "REPLACE_WITH_PII_ENTITY_TYPE"
});

console.log(result.redactedText);
// Output: "Hello, my name is [NAME] and my phone number is [PHONE]."
```

### Redact PII with Masking

```typescript
const result = await comprehend.redactPii({
    text: text,
    maskMode: "MASK"
});

console.log(result.redactedText);
// Output: "Hello, my name is ******** and my phone number is ************."
```

### Filter Specific PII Types

```typescript
import { PIIEntityType } from "@aws-sdk/client-comprehend";

const result = await comprehend.redactPii({
    text: text,
    piiEntityTypes: [PIIEntityType.NAME, PIIEntityType.EMAIL],
    maskMode: "REPLACE_WITH_PII_ENTITY_TYPE"
});

// This will only redact names and emails, leaving other PII types untouched
```

### Get Common PII Types

```typescript
import { Comprehend } from "@arakoodev/edgechains.js/ai";

// Get all supported PII entity types
const allTypes = Comprehend.getAllPIIEntityTypes();

// Get commonly used PII entity types
const commonTypes = Comprehend.getCommonPIIEntityTypes();
```

### Access PII Entity Type Constants

```typescript
import { Comprehend } from "@arakoodev/edgechains.js/ai";

const types = Comprehend.PIIEntityTypes;

console.log(types.NAME);              // "NAME"
console.log(types.EMAIL);             // "EMAIL"
console.log(types.PHONE);             // "PHONE"
console.log(types.SSN);               // "SSN"
console.log(types.CREDIT_DEBIT_CARD_NUMBER); // "CREDIT_DEBIT_CARD_NUMBER"
```

## Supported PII Entity Types

- `BANK_ACCOUNT_NUMBER` - Bank account numbers
- `BANK_ROUTING` - Bank routing numbers
- `CREDIT_DEBIT_CARD_CVV` - Credit/debit card CVV
- `CREDIT_DEBIT_CARD_EXPIRY` - Credit/debit card expiry date
- `CREDIT_DEBIT_CARD_NUMBER` - Credit/debit card numbers
- `PIN` - Personal identification numbers
- `EMAIL` - Email addresses
- `ADDRESS` - Physical addresses
- `NAME` - Person names
- `PHONE` - Phone numbers
- `SSN` - Social Security Numbers
- `DATE_TIME` - Date and time information
- `PASSPORT_NUMBER` - Passport numbers
- `DRIVER_ID` - Driver's license IDs
- `URL` - URLs
- `IP_ADDRESS` - IP addresses
- `MAC_ADDRESS` - MAC addresses
- `SSN_LAST_4` - Last 4 digits of SSN
- `USERNAME` - Usernames
- `PASSWORD` - Passwords
- `AWS_ACCESS_KEY` - AWS access keys
- `AWS_SECRET_KEY` - AWS secret keys
- `LICENSE_PLATE` - Vehicle license plates
- `VEHICLE_IDENTIFIER` - Vehicle identifiers
- `IBAN_CODE` - IBAN codes
- `TAX_ID` - Tax identification numbers
- `AGE` - Age information

## Error Handling

The module includes error handling for AWS API errors:

```typescript
const result = await comprehend.detectPiiEntities({
    text: "Some text"
});

if (result.Entities.length === 0) {
    console.log("No PII detected or an error occurred");
}
```

## AWS Credentials

Make sure your AWS credentials have the necessary permissions to use AWS Comprehend. Required IAM permissions:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "comprehend:DetectPiiEntities"
            ],
            "Resource": "*"
        }
    ]
}
```

## Costs

AWS Comprehend charges per character processed for PII detection. Check the [AWS Comprehend pricing](https://aws.amazon.com/comprehend/pricing/) for details.

## License

This module is part of EdgeChains and is licensed under the same terms.
