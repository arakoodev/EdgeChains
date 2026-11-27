import {
    ComprehendClient,
    DetectPiiEntitiesCommand,
    DetectPiiEntitiesCommandOutput,
    PiiEntity,
    LanguageCode,
    PiiEntityType,
} from "@aws-sdk/client-comprehend";
import { config } from "dotenv";
config();

interface ComprehendConstructionOptions {
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
}

interface RedactOptions {
    text: string;
    language?: LanguageCode;
    // Entity types to redact. Defaults to a broad set of common PII types.
    types?: PiiEntityType[];
    // Replacement token. Defaults to "[REDACTED]".
    mask?: string;
}

interface RedactResult {
    redactedText: string;
    entities: PiiEntity[];
}

// Default set of PII entity types redacted when none are supplied.
const DEFAULT_PII_TYPES: PiiEntityType[] = [
    "BANK_ACCOUNT_NUMBER",
    "CREDIT_DEBIT_NUMBER",
    "EMAIL",
    "PHONE",
    "SSN",
    "PASSPORT_NUMBER",
    "DRIVER_ID",
    "URL",
    "AGE",
    "NAME",
    "ADDRESS",
];

export class Comprehend {
    client: ComprehendClient;

    constructor(options: ComprehendConstructionOptions = {}) {
        const region = options.region || process.env.AWS_REGION || "us-east-1";
        const accessKeyId = options.accessKeyId || process.env.AWS_ACCESS_KEY_ID;
        const secretAccessKey = options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY;
        this.client = new ComprehendClient({
            region,
            // Only pass credentials when explicitly provided so the default
            // AWS credential provider chain is used otherwise.
            ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {}),
        });
    }

    /**
     * Detect PII entities in the supplied text using AWS Comprehend.
     * @param text The text to analyse.
     * @param language The language of the text. Defaults to English.
     * @returns The detected PII entities.
     */
    async detectPiiEntities(text: string, language: LanguageCode = "en"): Promise<PiiEntity[]> {
        const command = new DetectPiiEntitiesCommand({
            Text: text,
            LanguageCode: language,
        });
        const response: DetectPiiEntitiesCommandOutput = await this.client.send(command);
        return response.Entities || [];
    }

    /**
     * Redact PII entities in the supplied text. Entities are replaced with a
     * mask token, walking from the end of the string to the start so that the
     * character offsets of earlier entities remain valid as we mutate the text.
     * @param options The redaction options (text, language, types, mask).
     * @returns The redacted text together with the detected entities.
     */
    async redact(options: RedactOptions): Promise<RedactResult> {
        const { text, language = "en", types = DEFAULT_PII_TYPES, mask = "[REDACTED]" } = options;
        const entities = await this.detectPiiEntities(text, language);

        // Only redact the entity types requested, and ignore any malformed offsets.
        const targets = entities
            .filter((e) => types.includes(e.Type as PiiEntityType))
            .filter(
                (e) =>
                    typeof e.BeginOffset === "number" &&
                    typeof e.EndOffset === "number" &&
                    e.BeginOffset >= 0 &&
                    e.EndOffset > e.BeginOffset &&
                    e.EndOffset <= text.length
            )
            .sort((a, b) => (b.BeginOffset as number) - (a.BeginOffset as number));

        let redactedText = text;
        for (const entity of targets) {
            const begin = entity.BeginOffset as number;
            const end = entity.EndOffset as number;
            redactedText = redactedText.slice(0, begin) + mask + redactedText.slice(end);
        }

        return { redactedText, entities };
    }
}