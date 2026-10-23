import { createHash, createHmac } from "node:crypto";

export interface ComprehendPiiEntity {
    BeginOffset: number;
    EndOffset: number;
    Score: number;
    Type: string;
}

export interface DetectPiiEntitiesResponse {
    Entities: ComprehendPiiEntity[];
}

export interface ComprehendClientLike {
    detectPiiEntities(params: { Text: string; LanguageCode: string }): Promise<DetectPiiEntitiesResponse>;
}

export type PiiMaskMode = "TYPE_TAG" | "CHARACTER";

export interface ComprehendRedactorOptions {
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
    languageCode?: string;
    minScore?: number;
    maskMode?: PiiMaskMode;
    maskCharacter?: string;
    piiTypes?: string[];
    client?: ComprehendClientLike;
}

export interface RedactionEvent {
    originalText: string;
    redactedText: string;
    entities: ComprehendPiiEntity[];
    timestamp: string;
}

export type RedactionObserver =
    | ((event: RedactionEvent) => void)
    | { next: (event: RedactionEvent) => void; error?: (err: unknown) => void };

export interface ChatLikeEndpoint<TChatOptions = any, TChatResult = any> {
    chat(options: TChatOptions): Promise<TChatResult>;
    streamedChat?(options: TChatOptions): Promise<TChatResult>;
    chatWithFunction?(options: any): Promise<any>;
}

function sha256Hex(data: string): string {
    return createHash("sha256").update(data, "utf8").digest("hex");
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
    return createHmac("sha256", key).update(data, "utf8").digest();
}

export function signAwsComprehendRequest(params: {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
    body: string;
    amzDate: string;
}): Record<string, string> {
    const service = "comprehend";
    const host = `comprehend.${params.region}.amazonaws.com`;
    const dateStamp = params.amzDate.slice(0, 8);
    const target = "ComprehendService_20171127.DetectPiiEntities";
    const contentType = "application/x-amz-json-1.1";
    const payloadHash = sha256Hex(params.body);

    const canonicalHeaders =
        `content-type:${contentType}\n` +
        `host:${host}\n` +
        `x-amz-date:${params.amzDate}\n` +
        (params.sessionToken ? `x-amz-security-token:${params.sessionToken}\n` : "") +
        `x-amz-target:${target}\n`;

    const signedHeaders =
        "content-type;host;x-amz-date;" +
        (params.sessionToken ? "x-amz-security-token;" : "") +
        "x-amz-target";

    const canonicalRequest = [
        "POST",
        "/",
        "",
        canonicalHeaders,
        signedHeaders,
        payloadHash,
    ].join("\n");

    const algorithm = "AWS4-HMAC-SHA256";
    const credentialScope = `${dateStamp}/${params.region}/${service}/aws4_request`;
    const stringToSign = [
        algorithm,
        params.amzDate,
        credentialScope,
        sha256Hex(canonicalRequest),
    ].join("\n");

    const kDate = hmacSha256(`AWS4${params.secretAccessKey}`, dateStamp);
    const kRegion = hmacSha256(kDate, params.region);
    const kService = hmacSha256(kRegion, service);
    const kSigning = hmacSha256(kService, "aws4_request");
    const signature = createHmac("sha256", kSigning).update(stringToSign, "utf8").digest("hex");

    const headers: Record<string, string> = {
        "content-type": contentType,
        host,
        "x-amz-date": params.amzDate,
        "x-amz-target": target,
        Authorization: `${algorithm} Credential=${params.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    };
    if (params.sessionToken) {
        headers["x-amz-security-token"] = params.sessionToken;
    }
    return headers;
}

export class ComprehendPiiRedactor {
    private region: string;
    private accessKeyId: string;
    private secretAccessKey: string;
    private sessionToken?: string;
    private languageCode: string;
    private minScore: number;
    private maskMode: PiiMaskMode;
    private maskCharacter: string;
    private piiTypes: Set<string> | null;
    private client?: ComprehendClientLike;
    private observers: Set<{ next: (e: RedactionEvent) => void; error?: (err: unknown) => void }> = new Set();

    constructor(options: ComprehendRedactorOptions = {}) {
        this.region = options.region || process.env.AWS_REGION || "us-east-1";
        this.accessKeyId = options.accessKeyId || process.env.AWS_ACCESS_KEY_ID || "";
        this.secretAccessKey = options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || "";
        this.sessionToken = options.sessionToken || process.env.AWS_SESSION_TOKEN;
        this.languageCode = options.languageCode || "en";
        this.minScore = options.minScore ?? 0.5;
        this.maskMode = options.maskMode || "TYPE_TAG";
        this.maskCharacter = options.maskCharacter || "*";
        this.piiTypes = options.piiTypes && options.piiTypes.length > 0 ? new Set(options.piiTypes) : null;
        this.client = options.client;
    }

    subscribe(observer: RedactionObserver): { unsubscribe: () => void } {
        const normalized = typeof observer === "function" ? { next: observer } : observer;
        this.observers.add(normalized);
        return {
            unsubscribe: () => {
                this.observers.delete(normalized);
            },
        };
    }

    private emit(event: RedactionEvent): void {
        for (const obs of this.observers) {
            obs.next(event);
        }
    }

    async detectPiiEntities(text: string): Promise<ComprehendPiiEntity[]> {
        if (!text) return [];
        if (this.client) {
            const res = await this.client.detectPiiEntities({
                Text: text,
                LanguageCode: this.languageCode,
            });
            return res.Entities || [];
        }

        const body = JSON.stringify({
            Text: text,
            LanguageCode: this.languageCode,
        });
        const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
        const headers = signAwsComprehendRequest({
            region: this.region,
            accessKeyId: this.accessKeyId,
            secretAccessKey: this.secretAccessKey,
            sessionToken: this.sessionToken,
            body,
            amzDate,
        });
        const endpoint = `https://comprehend.${this.region}.amazonaws.com/`;
        const response = await fetch(endpoint, { method: "POST", headers, body });
        if (!response.ok) {
            throw new Error(`AWS Comprehend DetectPiiEntities failed with HTTP ${response.status}`);
        }
        const data = (await response.json()) as DetectPiiEntitiesResponse;
        return data?.Entities || [];
    }

    applyRedaction(text: string, entities: ComprehendPiiEntity[]): { redactedText: string; matchedEntities: ComprehendPiiEntity[] } {
        const filtered = entities
            .filter((e) => {
                if ((e.Score ?? 1) < this.minScore) return false;
                if (this.piiTypes && !this.piiTypes.has(e.Type)) return false;
                return (
                    Number.isInteger(e.BeginOffset) &&
                    Number.isInteger(e.EndOffset) &&
                    e.BeginOffset >= 0 &&
                    e.EndOffset <= text.length &&
                    e.BeginOffset < e.EndOffset
                );
            })
            .sort((a, b) => a.BeginOffset - b.BeginOffset);

        if (filtered.length === 0) {
            return { redactedText: text, matchedEntities: [] };
        }

        let cursor = 0;
        let result = "";
        const applied: ComprehendPiiEntity[] = [];

        for (const entity of filtered) {
            if (entity.BeginOffset < cursor) continue;
            result += text.slice(cursor, entity.BeginOffset);
            const spanLength = entity.EndOffset - entity.BeginOffset;
            const replacement =
                this.maskMode === "CHARACTER"
                    ? this.maskCharacter.repeat(spanLength)
                    : `[${entity.Type}]`;
            result += replacement;
            cursor = entity.EndOffset;
            applied.push(entity);
        }
        result += text.slice(cursor);
        return { redactedText: result, matchedEntities: applied };
    }

    async redactText(text: string): Promise<string> {
        const entities = await this.detectPiiEntities(text);
        const { redactedText, matchedEntities } = this.applyRedaction(text, entities);
        this.emit({
            originalText: text,
            redactedText,
            entities: matchedEntities,
            timestamp: new Date().toISOString(),
        });
        return redactedText;
    }

    async redactChatOptions<T extends { prompt?: string; messages?: Array<{ role: any; content: string; name?: string }> }>(
        chatOptions: T
    ): Promise<T> {
        const cloned: T = { ...chatOptions };
        if (typeof cloned.prompt === "string") {
            cloned.prompt = await this.redactText(cloned.prompt);
        }
        if (Array.isArray(cloned.messages)) {
            cloned.messages = await Promise.all(
                cloned.messages.map(async (msg) => ({
                    ...msg,
                    content: typeof msg.content === "string" ? await this.redactText(msg.content) : msg.content,
                }))
            );
        }
        return cloned;
    }

    chain<TEndpoint extends ChatLikeEndpoint>(endpoint: TEndpoint): RedactedEndpointChain<TEndpoint> {
        return new RedactedEndpointChain(this, endpoint);
    }
}

export class RedactedEndpointChain<TEndpoint extends ChatLikeEndpoint> {
    constructor(
        public readonly redactor: ComprehendPiiRedactor,
        public readonly endpoint: TEndpoint
    ) {}

    subscribe(observer: RedactionObserver): { unsubscribe: () => void } {
        return this.redactor.subscribe(observer);
    }

    async chat(chatOptions: any): Promise<any> {
        const safeOptions = await this.redactor.redactChatOptions(chatOptions);
        return this.endpoint.chat(safeOptions);
    }

    async streamedChat(chatOptions: any): Promise<any> {
        if (typeof this.endpoint.streamedChat !== "function") {
            throw new Error("Underlying endpoint does not support streamedChat.");
        }
        const safeOptions = await this.redactor.redactChatOptions(chatOptions);
        return this.endpoint.streamedChat(safeOptions);
    }

    async chatWithFunction(chatOptions: any): Promise<any> {
        if (typeof this.endpoint.chatWithFunction !== "function") {
            throw new Error("Underlying endpoint does not support chatWithFunction.");
        }
        const safeOptions = await this.redactor.redactChatOptions(chatOptions);
        return this.endpoint.chatWithFunction(safeOptions);
    }
}
