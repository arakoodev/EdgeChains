import {
    ComprehendClient,
    DetectPiiEntitiesCommand,
    LanguageCode,
    PiiEntity,
} from "@aws-sdk/client-comprehend";

export enum RedactionMode {
    /** Replace each entity with its type label, e.g. [NAME] */
    TYPE_LABEL = "TYPE_LABEL",
    /** Replace each entity with a repeated mask character, e.g. **** */
    MASK = "MASK",
}

export interface ComprehendRedactorOptions {
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
    /** Comprehend language code for the input text. Defaults to "en". */
    languageCode?: string;
    /** Restrict detection to these PII entity types (e.g. ["NAME", "EMAIL"]). Defaults to all. */
    entityTypes?: string[];
    /** Only redact entities at or above this confidence score (0-1). Defaults to 0. */
    minConfidence?: number;
    /** Redaction style. Defaults to TYPE_LABEL. */
    mode?: RedactionMode;
    /** Character used by MASK mode. Defaults to "*". */
    maskCharacter?: string;
}

export interface RedactedEntity {
    type: string;
    beginOffset: number;
    endOffset: number;
    score: number;
}

export interface RedactionResult {
    originalText: string;
    redactedText: string;
    entities: RedactedEntity[];
}

/** Minimal shape of an Endpoint class that can be chained with the redactor. */
export interface ChatEndpoint {
    chat(options: { prompt?: string; messages?: Array<{ role: string; content: string }> } & Record<
        string,
        unknown
    >): Promise<unknown>;
}

/**
 * Redacts sensitive information (PII) from text using Amazon Comprehend.
 *
 * Can be chained with existing Endpoint classes: `redactor.chain(endpoint)`
 * returns an endpoint with the same contract whose prompt/messages are
 * redacted before they are sent to the model.
 */
export class ComprehendRedactor {
    private client: ComprehendClient;
    private languageCode: LanguageCode;
    private entityTypes?: string[];
    private minConfidence: number;
    private mode: RedactionMode;
    private maskCharacter: string;

    constructor(options: ComprehendRedactorOptions = {}) {
        const region = options.region || process.env.AWS_REGION || "us-east-1";
        const accessKeyId = options.accessKeyId || process.env.AWS_ACCESS_KEY_ID;
        const secretAccessKey = options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY;
        const sessionToken = options.sessionToken || process.env.AWS_SESSION_TOKEN;

        this.client = new ComprehendClient({
            region,
            credentials:
                accessKeyId && secretAccessKey
                    ? { accessKeyId, secretAccessKey, sessionToken }
                    : undefined,
        });
        this.languageCode = (options.languageCode || "en") as LanguageCode;
        this.entityTypes = options.entityTypes;
        this.minConfidence = options.minConfidence ?? 0;
        this.mode = options.mode || RedactionMode.TYPE_LABEL;
        this.maskCharacter = options.maskCharacter || "*";
    }

    /** Detect PII entities in the given text. */
    async detectEntities(text: string): Promise<RedactedEntity[]> {
        const response = await this.client.send(
            new DetectPiiEntitiesCommand({ Text: text, LanguageCode: this.languageCode })
        );
        return (response.Entities || [])
            .filter((entity: PiiEntity) => {
                if (entity.BeginOffset === undefined || entity.EndOffset === undefined) return false;
                if ((entity.Score ?? 1) < this.minConfidence) return false;
                if (this.entityTypes && !this.entityTypes.includes(entity.Type as string)) return false;
                return true;
            })
            .map((entity: PiiEntity) => ({
                type: entity.Type as string,
                beginOffset: entity.BeginOffset as number,
                endOffset: entity.EndOffset as number,
                score: entity.Score ?? 0,
            }));
    }

    /** Detect and redact PII from the given text. */
    async redact(text: string): Promise<RedactionResult> {
        const entities = await this.detectEntities(text);
        let redactedText = text;
        // Splice from the end so earlier offsets stay valid.
        const sorted = [...entities].sort((a, b) => b.beginOffset - a.beginOffset);
        for (const entity of sorted) {
            const original = redactedText.slice(entity.beginOffset, entity.endOffset);
            const replacement =
                this.mode === RedactionMode.MASK
                    ? this.maskCharacter.repeat(original.length)
                    : `[${entity.type}]`;
            redactedText =
                redactedText.slice(0, entity.beginOffset) +
                replacement +
                redactedText.slice(entity.endOffset);
        }
        return { originalText: text, redactedText, entities };
    }

    /** Convenience wrapper returning only the redacted text. */
    async redactText(text: string): Promise<string> {
        return (await this.redact(text)).redactedText;
    }

    /**
     * Chain the redactor with an existing Endpoint class. The returned object
     * has the same `chat` contract as the endpoint, but the prompt and message
     * contents are redacted before the call is delegated.
     */
    chain<T extends ChatEndpoint>(endpoint: T): T {
        const redactor = this;
        return new Proxy(endpoint, {
            get(target, prop, receiver) {
                const value = Reflect.get(target, prop, receiver);
                if (typeof value !== "function") return value;
                return async function (this: unknown, ...args: unknown[]) {
                    const redactedArgs = await Promise.all(
                        args.map((arg) => redactor.redactArgument(arg))
                    );
                    return value.apply(target, redactedArgs);
                };
            },
        });
    }

    private async redactArgument(arg: unknown): Promise<unknown> {
        if (typeof arg === "string") return this.redactText(arg);
        if (arg && typeof arg === "object") {
            const copy: Record<string, unknown> = { ...(arg as Record<string, unknown>) };
            if (typeof copy.prompt === "string") copy.prompt = await this.redactText(copy.prompt);
            if (Array.isArray(copy.messages)) {
                copy.messages = await Promise.all(
                    copy.messages.map(async (message) => {
                        if (message && typeof message.content === "string") {
                            return { ...message, content: await this.redactText(message.content) };
                        }
                        return message;
                    })
                );
            }
            return copy;
        }
        return arg;
    }
}
