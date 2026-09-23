import {
    ComprehendClient,
    DetectPiiEntitiesCommand,
    ContainsPiiEntitiesCommand,
    LanguageCode,
    PiiEntityType,
    PiiEntity,
} from "@aws-sdk/client-comprehend";

export interface AWSComprehendOptions {
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
}

export interface RedactOptions {
    text: string;
    languageCode?: LanguageCode;
    piiEntityTypes?: PiiEntityType[];
    minConfidence?: number;
    redactionChar?: string;
    strategy?: "char" | "type" | "fixed";
}

export interface DetectedEntity {
    type: string;
    score: number;
    beginOffset: number;
    endOffset: number;
}

export interface RedactResult {
    originalText: string;
    redactedText: string;
    entitiesFound: DetectedEntity[];
}

export interface DetectPiiOptions {
    text: string;
    languageCode?: LanguageCode;
}

export interface DetectPiiResult {
    containsPii: boolean;
    entities: DetectedEntity[];
}

// Wrapper around AWS Comprehend's PII detection / redaction APIs.
// Use redact() for one-off calls or chain() to pipe a redacted prompt
// straight into one of the existing Endpoint classes (OpenAI, GeminiAI,
// LlamaAI, RetellAI). For RxJS-style composition see ./observables.
export class AWSComprehend {
    private readonly client: ComprehendClient;
    public readonly region: string;

    constructor(options: AWSComprehendOptions = {}) {
        this.region =
            options.region ||
            process.env.AWS_REGION ||
            process.env.AWS_DEFAULT_REGION ||
            "us-east-1";

        const accessKeyId = options.accessKeyId || process.env.AWS_ACCESS_KEY_ID;
        const secretAccessKey =
            options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY;
        const sessionToken =
            options.sessionToken || process.env.AWS_SESSION_TOKEN;

        const clientConfig: ConstructorParameters<typeof ComprehendClient>[0] = {
            region: this.region,
        };

        if (accessKeyId && secretAccessKey) {
            clientConfig.credentials = {
                accessKeyId,
                secretAccessKey,
                ...(sessionToken ? { sessionToken } : {}),
            };
        } else {
            // fall back to the default AWS credential chain (IAM role,
            // ~/.aws/credentials, container/instance metadata, ...)
            console.warn(
                "[AWSComprehend] No explicit credentials supplied. Falling back to the AWS default credential chain."
            );
        }

        this.client = new ComprehendClient(clientConfig);
    }

    async detectPii(options: DetectPiiOptions): Promise<DetectPiiResult> {
        const { text, languageCode = "en" as LanguageCode } = options;
        this.assertText(text);

        const command = new DetectPiiEntitiesCommand({
            Text: text,
            LanguageCode: languageCode,
        });

        const response = await this.client.send(command);
        const entities: DetectedEntity[] = (response.Entities || []).map(
            (e: PiiEntity) => ({
                type: e.Type ?? "UNKNOWN",
                score: e.Score ?? 0,
                beginOffset: e.BeginOffset ?? 0,
                endOffset: e.EndOffset ?? 0,
            })
        );

        return {
            containsPii: entities.length > 0,
            entities,
        };
    }

    // Lightweight precheck using the cheaper ContainsPiiEntities API.
    async containsPii(options: DetectPiiOptions): Promise<boolean> {
        const { text, languageCode = "en" as LanguageCode } = options;
        this.assertText(text);

        const command = new ContainsPiiEntitiesCommand({
            Text: text,
            LanguageCode: languageCode,
        });
        const response = await this.client.send(command);
        return (response.Labels ?? []).some((l) => (l.Score ?? 0) > 0.5);
    }

    async redact(options: RedactOptions): Promise<RedactResult> {
        const {
            text,
            languageCode = "en" as LanguageCode,
            piiEntityTypes,
            minConfidence = 0.5,
            redactionChar = "*",
            strategy = "char",
        } = options;
        this.assertText(text);

        const detection = await this.detectPii({ text, languageCode });

        if (!detection.containsPii) {
            return { originalText: text, redactedText: text, entitiesFound: [] };
        }

        const wanted = detection.entities.filter((e) => {
            if (e.score < minConfidence) return false;
            if (piiEntityTypes && piiEntityTypes.length > 0) {
                return piiEntityTypes.includes(e.type as PiiEntityType);
            }
            return true;
        });

        // Splice from end to start so earlier offsets stay valid.
        const ordered = [...wanted].sort((a, b) => b.beginOffset - a.beginOffset);

        let redactedText = text;
        for (const entity of ordered) {
            const before = redactedText.substring(0, entity.beginOffset);
            const after = redactedText.substring(entity.endOffset);
            const replacement = this.buildReplacement(
                entity,
                redactionChar,
                strategy
            );
            redactedText = before + replacement + after;
        }

        return {
            originalText: text,
            redactedText,
            entitiesFound: detection.entities,
        };
    }

    async redactBatch(
        texts: string[],
        options: Omit<RedactOptions, "text"> = {}
    ): Promise<RedactResult[]> {
        return Promise.all(texts.map((text) => this.redact({ ...options, text })));
    }

    // Helper: redact `text` and forward the redacted string to `next`.
    // Convenient when you want a one-liner inside async/await code that
    // calls one of the existing Endpoint classes.
    async chain<T>(
        text: string,
        next: (redactedText: string) => Promise<T> | T,
        options: Omit<RedactOptions, "text"> = {}
    ): Promise<T> {
        const { redactedText } = await this.redact({ ...options, text });
        return next(redactedText);
    }

    private buildReplacement(
        entity: DetectedEntity,
        char: string,
        strategy: "char" | "type" | "fixed"
    ): string {
        if (strategy === "type") return `[${entity.type}]`;
        if (strategy === "fixed") return char;
        return char.repeat(Math.max(1, entity.endOffset - entity.beginOffset));
    }

    private assertText(text: unknown): asserts text is string {
        if (typeof text !== "string" || text.length === 0) {
            throw new TypeError(
                "AWSComprehend: `text` must be a non-empty string."
            );
        }
        // AWS Comprehend's DetectPiiEntities rejects payloads > 100 KB.
        const bytes = Buffer.byteLength(text as string, "utf8");
        if (bytes > 100_000) {
            throw new RangeError(
                `AWSComprehend: input is ${bytes} bytes, exceeds the 100,000-byte AWS Comprehend limit.`
            );
        }
    }
}
