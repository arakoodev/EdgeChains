import { createHash, createHmac } from "node:crypto";

export type PiiRedactionStrategy = "label" | "mask" | "fixed";

export interface AwsCredentials {
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
}

export interface ComprehendPiiEntity {
    BeginOffset: number;
    EndOffset: number;
    Score: number;
    Type: string;
}

export interface DetectPiiEntitiesInput {
    Text: string;
    LanguageCode?: string;
}

export interface DetectPiiEntitiesOutput {
    Entities?: ComprehendPiiEntity[];
}

export interface ComprehendPiiClient {
    detectPiiEntities(input: DetectPiiEntitiesInput): Promise<DetectPiiEntitiesOutput>;
}

export interface AWSComprehendRedactorOptions {
    client?: ComprehendPiiClient;
    credentials?: AwsCredentials;
    entityTypes?: string[];
    languageCode?: string;
    maskCharacter?: string;
    minScore?: number;
    region?: string;
    replacementText?: string;
    strategy?: PiiRedactionStrategy;
}

export interface PiiRedactionResult {
    originalText: string;
    redactedText: string;
    entities: ComprehendPiiEntity[];
}

export interface MessageLike {
    content: string;
    [key: string]: unknown;
}

export interface PromptChatOptions {
    messages?: MessageLike[];
    prompt?: string;
    [key: string]: unknown;
}

export interface ChatEndpoint<TOptions extends PromptChatOptions = PromptChatOptions, TReturn = unknown> {
    chat(options: TOptions): Promise<TReturn> | TReturn;
}

export interface SubscriptionLike {
    unsubscribe(): void;
}

export interface ObserverLike<T> {
    complete?: () => void;
    error?: (error: unknown) => void;
    next?: (value: T) => void;
}

export interface ObservableLike<T> {
    subscribe(observer: ObserverLike<T> | ((value: T) => void)): SubscriptionLike | void;
}

const DEFAULT_LANGUAGE_CODE = "en";
const DEFAULT_MIN_SCORE = 0.5;
const DEFAULT_REGION = "us-east-1";

function hash(value: string): string {
    return createHash("sha256").update(value, "utf8").digest("hex");
}

function hmac(key: Buffer | string, value: string): Buffer {
    return createHmac("sha256", key).update(value, "utf8").digest();
}

function getSignatureKey(secretAccessKey: string, dateStamp: string, region: string): Buffer {
    const dateKey = hmac(`AWS4${secretAccessKey}`, dateStamp);
    const regionKey = hmac(dateKey, region);
    const serviceKey = hmac(regionKey, "comprehend");
    return hmac(serviceKey, "aws4_request");
}

function toAmzDate(date: Date): string {
    return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function assertAwsCredentials(credentials: Required<Pick<AwsCredentials, "accessKeyId" | "secretAccessKey">>) {
    if (!credentials.accessKeyId || !credentials.secretAccessKey) {
        throw new Error(
            "AWS credentials are required. Provide accessKeyId/secretAccessKey or set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY."
        );
    }
}

export class AwsComprehendRestClient implements ComprehendPiiClient {
    private readonly credentials: Required<Pick<AwsCredentials, "accessKeyId" | "secretAccessKey">> &
        Pick<AwsCredentials, "sessionToken">;
    private readonly region: string;

    constructor(options: Pick<AWSComprehendRedactorOptions, "credentials" | "region"> = {}) {
        this.region = options.region || process.env.AWS_REGION || DEFAULT_REGION;
        this.credentials = {
            accessKeyId: options.credentials?.accessKeyId || process.env.AWS_ACCESS_KEY_ID || "",
            secretAccessKey:
                options.credentials?.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || "",
            sessionToken: options.credentials?.sessionToken || process.env.AWS_SESSION_TOKEN,
        };
    }

    async detectPiiEntities(input: DetectPiiEntitiesInput): Promise<DetectPiiEntitiesOutput> {
        assertAwsCredentials(this.credentials);

        const body = JSON.stringify({
            LanguageCode: input.LanguageCode || DEFAULT_LANGUAGE_CODE,
            Text: input.Text,
        });
        const endpoint = `https://comprehend.${this.region}.amazonaws.com/`;
        const url = new URL(endpoint);
        const now = new Date();
        const amzDate = toAmzDate(now);
        const dateStamp = amzDate.slice(0, 8);
        const target = "Comprehend_20171127.DetectPiiEntities";

        const signingHeaders: Record<string, string> = {
            "content-type": "application/x-amz-json-1.1",
            host: url.host,
            "x-amz-date": amzDate,
            "x-amz-target": target,
        };
        if (this.credentials.sessionToken) {
            signingHeaders["x-amz-security-token"] = this.credentials.sessionToken;
        }

        const sortedHeaderNames = Object.keys(signingHeaders).sort();
        const canonicalHeaders = sortedHeaderNames
            .map((name) => `${name}:${signingHeaders[name]}\n`)
            .join("");
        const signedHeaders = sortedHeaderNames.join(";");
        const canonicalRequest = [
            "POST",
            "/",
            "",
            canonicalHeaders,
            signedHeaders,
            hash(body),
        ].join("\n");
        const credentialScope = `${dateStamp}/${this.region}/comprehend/aws4_request`;
        const stringToSign = [
            "AWS4-HMAC-SHA256",
            amzDate,
            credentialScope,
            hash(canonicalRequest),
        ].join("\n");
        const signature = createHmac(
            "sha256",
            getSignatureKey(this.credentials.secretAccessKey, dateStamp, this.region)
        )
            .update(stringToSign, "utf8")
            .digest("hex");
        const authorization = [
            `AWS4-HMAC-SHA256 Credential=${this.credentials.accessKeyId}/${credentialScope}`,
            `SignedHeaders=${signedHeaders}`,
            `Signature=${signature}`,
        ].join(", ");

        const response = await fetch(endpoint, {
            body,
            headers: {
                Authorization: authorization,
                "Content-Type": signingHeaders["content-type"],
                "X-Amz-Date": amzDate,
                "X-Amz-Target": target,
                ...(this.credentials.sessionToken
                    ? { "X-Amz-Security-Token": this.credentials.sessionToken }
                    : {}),
            },
            method: "POST",
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`AWS Comprehend request failed: ${response.status} ${errorBody}`);
        }

        return (await response.json()) as DetectPiiEntitiesOutput;
    }
}

export class AWSComprehendRedactor {
    private readonly client: ComprehendPiiClient;
    private readonly defaults: Required<
        Pick<
            AWSComprehendRedactorOptions,
            "languageCode" | "maskCharacter" | "minScore" | "replacementText" | "strategy"
        >
    > &
        Pick<AWSComprehendRedactorOptions, "entityTypes">;

    constructor(options: AWSComprehendRedactorOptions = {}) {
        this.client = options.client || new AwsComprehendRestClient(options);
        this.defaults = {
            entityTypes: options.entityTypes,
            languageCode: options.languageCode || DEFAULT_LANGUAGE_CODE,
            maskCharacter: options.maskCharacter || "*",
            minScore: options.minScore ?? DEFAULT_MIN_SCORE,
            replacementText: options.replacementText || "[REDACTED]",
            strategy: options.strategy || "label",
        };
    }

    async detectPiiEntities(
        text: string,
        options: Pick<AWSComprehendRedactorOptions, "languageCode"> = {}
    ): Promise<ComprehendPiiEntity[]> {
        const response = await this.client.detectPiiEntities({
            LanguageCode: options.languageCode || this.defaults.languageCode,
            Text: text,
        });
        return response.Entities || [];
    }

    async redactText(
        text: string,
        options: Pick<
            AWSComprehendRedactorOptions,
            "entityTypes" | "languageCode" | "maskCharacter" | "minScore" | "replacementText" | "strategy"
        > = {}
    ): Promise<PiiRedactionResult> {
        const entities = this.filterEntities(
            await this.detectPiiEntities(text, options),
            options.entityTypes || this.defaults.entityTypes,
            options.minScore ?? this.defaults.minScore
        );

        const redactedText = entities
            .slice()
            .sort((left, right) => right.BeginOffset - left.BeginOffset)
            .reduce((value, entity) => {
                return (
                    value.slice(0, entity.BeginOffset) +
                    this.replacementFor(entity, text, options) +
                    value.slice(entity.EndOffset)
                );
            }, text);

        return {
            entities,
            originalText: text,
            redactedText,
        };
    }

    async redactChatOptions<TOptions extends PromptChatOptions>(
        chatOptions: TOptions,
        options: Parameters<AWSComprehendRedactor["redactText"]>[1] = {}
    ): Promise<TOptions> {
        const nextOptions: PromptChatOptions = { ...chatOptions };
        if (typeof chatOptions.prompt === "string") {
            nextOptions.prompt = (await this.redactText(chatOptions.prompt, options)).redactedText;
        }
        if (Array.isArray(chatOptions.messages)) {
            nextOptions.messages = await Promise.all(
                chatOptions.messages.map(async (message) => ({
                    ...message,
                    content: (await this.redactText(message.content, options)).redactedText,
                }))
            );
        }
        return nextOptions as TOptions;
    }

    chainEndpoint<TOptions extends PromptChatOptions, TReturn>(
        endpoint: ChatEndpoint<TOptions, TReturn>,
        options: Parameters<AWSComprehendRedactor["redactText"]>[1] = {}
    ): ChatEndpoint<TOptions, TReturn> {
        return {
            chat: async (chatOptions: TOptions) => {
                return endpoint.chat(await this.redactChatOptions(chatOptions, options));
            },
        };
    }

    redactText$(
        source: ObservableLike<string>,
        options: Parameters<AWSComprehendRedactor["redactText"]>[1] = {}
    ): ObservableLike<PiiRedactionResult> {
        return this.mapObservable(source, (value) => this.redactText(value, options));
    }

    redactTextOperator(
        options: Parameters<AWSComprehendRedactor["redactText"]>[1] = {}
    ): (source: ObservableLike<string>) => ObservableLike<PiiRedactionResult> {
        return (source) => this.redactText$(source, options);
    }

    private filterEntities(
        entities: ComprehendPiiEntity[],
        entityTypes: string[] | undefined,
        minScore: number
    ): ComprehendPiiEntity[] {
        return entities.filter((entity) => {
            const hasRequestedType = !entityTypes || entityTypes.includes(entity.Type);
            return hasRequestedType && entity.Score >= minScore;
        });
    }

    private mapObservable<TInput, TOutput>(
        source: ObservableLike<TInput>,
        project: (value: TInput) => Promise<TOutput>
    ): ObservableLike<TOutput> {
        return {
            subscribe(observerOrNext: ObserverLike<TOutput> | ((value: TOutput) => void)) {
                const observer =
                    typeof observerOrNext === "function" ? { next: observerOrNext } : observerOrNext;
                const pending: Promise<void>[] = [];

                const subscription = source.subscribe({
                    complete: () => {
                        Promise.all(pending)
                            .then(() => observer.complete?.())
                            .catch((error) => observer.error?.(error));
                    },
                    error: (error) => observer.error?.(error),
                    next: (value) => {
                        pending.push(
                            project(value)
                                .then((mapped) => observer.next?.(mapped))
                                .catch((error) => observer.error?.(error))
                        );
                    },
                });

                return {
                    unsubscribe() {
                        subscription?.unsubscribe();
                    },
                };
            },
        };
    }

    private replacementFor(
        entity: ComprehendPiiEntity,
        text: string,
        options: Pick<
            AWSComprehendRedactorOptions,
            "maskCharacter" | "replacementText" | "strategy"
        > = {}
    ): string {
        const strategy = options.strategy || this.defaults.strategy;
        if (strategy === "label") return `[${entity.Type}]`;
        if (strategy === "fixed") return options.replacementText || this.defaults.replacementText;

        const spanLength = Math.max(entity.EndOffset - entity.BeginOffset, 0);
        const maskCharacter = options.maskCharacter || this.defaults.maskCharacter;
        return maskCharacter.repeat(spanLength || text.slice(entity.BeginOffset, entity.EndOffset).length);
    }
}
