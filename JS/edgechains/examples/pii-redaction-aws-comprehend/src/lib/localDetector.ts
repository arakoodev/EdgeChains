import type {
    CommandExecutor,
    ComprehendClientOptions,
} from "@arakoodev/edgechains.js/aws-comprehend";

interface PiiEntityResult {
    Score?: number;
    Type?: string;
    BeginOffset?: number;
    EndOffset?: number;
}

/**
 * A drop-in replacement for the Amazon Comprehend command executor that
 * detects a few common PII patterns with plain expressions. It exists so the
 * example can run end to end without AWS credentials; the results mirror the
 * DetectPiiEntities response shape and are chunked exactly like the real
 * service call in AwsComprehend.
 */
const PATTERNS: Array<{ type: string; pattern: RegExp }> = [
    { type: "EMAIL", pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
    { type: "PHONE", pattern: /\d{3}[-.\s]\d{3}[-.\s]\d{4}/g },
    { type: "SSN", pattern: /\d{3}-\d{2}-\d{4}/g },
    { type: "NAME", pattern: /\b(?:Jane|John|Alice|Bob) (?:Smith|Doe|Johnson|Brown|Wilson)\b/g },
    { type: "ADDRESS", pattern: /\d+[A-Za-z]?\s+\w+\s+(?:Street|Avenue|Road|Boulevard)/g },
    {
        type: "CREDIT_DEBIT_NUMBER",
        pattern: /\b(?:4\d{3}|5[1-5]\d{2})[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/g,
    },
];

export const localDetectorClient: CommandExecutor = {
    async send(command: unknown): Promise<unknown> {
        const text = (command as { input: { Text: string } }).input.Text;

        const entities: PiiEntityResult[] = [];
        for (const { type, pattern } of PATTERNS) {
            const matcher = new RegExp(pattern.source, pattern.flags);
            let match = matcher.exec(text);
            while (match !== null) {
                entities.push({
                    Score: 0.99,
                    Type: type,
                    BeginOffset: match.index,
                    EndOffset: match.index + match[0].length,
                });
                match = matcher.exec(text);
            }
        }

        return { Entities: entities };
    },
};

/**
 * Returns the client options the example should use. Real AWS credentials
 * take precedence; without them the example falls back to the local
 * detector so the redaction chain can still be demonstrated.
 */
export const resolveClientOptions = (): ComprehendClientOptions => {
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
        console.log("Using Amazon Comprehend with the AWS credentials in the environment.\n");
        return { region: process.env.AWS_REGION };
    }

    console.log(
        "AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY are not set; " +
            "falling back to the bundled local detector for this demo.\n"
    );
    return { client: localDetectorClient };
};
