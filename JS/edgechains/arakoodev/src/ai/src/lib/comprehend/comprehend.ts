import axios from "axios";
import { createHash, createHmac } from "crypto";

const ALGORITHM = "AWS4-HMAC-SHA256";
const SERVICE = "comprehend";
const API_VERSION = "Comprehend_20171127";

interface ComprehendConstructionOptions {
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
    region?: string;
}

interface PiiEntity {
    Score: number;
    Type: string;
    BeginOffset: number;
    EndOffset: number;
}

interface DetectPiiEntitiesOptions {
    text: string;
    languageCode?: string;
}

interface RedactOptions {
    text: string;
    languageCode?: string;
    // When provided, every detected PII span is replaced by this character
    // repeated to the length of the span (e.g. "*"). When omitted, the span is
    // replaced by its entity type tag (e.g. "[EMAIL]").
    maskCharacter?: string;
    // Restrict redaction to these Comprehend entity types (e.g. ["EMAIL", "SSN"]).
    types?: string[];
}

interface RedactableEndpoint {
    chat(chatOptions: {
        prompt?: string;
        messages?: { content: string }[];
        [key: string]: any;
    }): Promise<any>;
}

function hmac(key: Buffer | string, data: string): Buffer {
    return createHmac("sha256", key).update(data, "utf8").digest();
}

function sha256Hex(data: string): string {
    return createHash("sha256").update(data, "utf8").digest("hex");
}

export class Comprehend {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
    region: string;

    constructor(options: ComprehendConstructionOptions = {}) {
        this.accessKeyId = options.accessKeyId || process.env.AWS_ACCESS_KEY_ID || "";
        this.secretAccessKey = options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || "";
        this.sessionToken = options.sessionToken || process.env.AWS_SESSION_TOKEN || "";
        this.region = options.region || process.env.AWS_REGION || "us-east-1";
        this.checkKeys();
    }

    private checkKeys(): void {
        if (!this.accessKeyId || !this.secretAccessKey) {
            console.error(
                "AWS credentials are missing. Please provide a valid accessKeyId and secretAccessKey. You can add them in .env file as AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY"
            );
        }
    }

    private sign(action: string, payload: string): Record<string, string> {
        const host = `comprehend.${this.region}.amazonaws.com`;
        const target = `${API_VERSION}.${action}`;
        const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
        const dateStamp = amzDate.slice(0, 8);

        const canonicalHeaders =
            `content-type:application/x-amz-json-1.1\n` +
            `host:${host}\n` +
            `x-amz-date:${amzDate}\n` +
            `x-amz-target:${target}\n`;
        const signedHeaders = "content-type;host;x-amz-date;x-amz-target";
        const canonicalRequest = [
            "POST",
            "/",
            "",
            canonicalHeaders,
            signedHeaders,
            sha256Hex(payload),
        ].join("\n");

        const credentialScope = `${dateStamp}/${this.region}/${SERVICE}/aws4_request`;
        const stringToSign = [
            ALGORITHM,
            amzDate,
            credentialScope,
            sha256Hex(canonicalRequest),
        ].join("\n");

        const kDate = hmac(`AWS4${this.secretAccessKey}`, dateStamp);
        const kRegion = hmac(kDate, this.region);
        const kService = hmac(kRegion, SERVICE);
        const kSigning = hmac(kService, "aws4_request");
        const signature = createHmac("sha256", kSigning)
            .update(stringToSign, "utf8")
            .digest("hex");

        const headers: Record<string, string> = {
            "Content-Type": "application/x-amz-json-1.1",
            "X-Amz-Date": amzDate,
            "X-Amz-Target": target,
            Authorization: `${ALGORITHM} Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
        };
        if (this.sessionToken) {
            headers["X-Amz-Security-Token"] = this.sessionToken;
        }
        return headers;
    }

    async detectPiiEntities(options: DetectPiiEntitiesOptions): Promise<PiiEntity[]> {
        const payload = JSON.stringify({
            Text: options.text,
            LanguageCode: options.languageCode || "en",
        });
        const response = await axios
            .post(`https://comprehend.${this.region}.amazonaws.com/`, payload, {
                headers: this.sign("DetectPiiEntities", payload),
            })
            .then((response) => response.data.Entities || [])
            .catch((error) => {
                if (error.response) {
                    console.log("Server responded with status code:", error.response.status);
                    console.log("Response data:", error.response.data);
                } else if (error.request) {
                    console.log("No response received:", error);
                } else {
                    console.log("Error creating request:", error.message);
                }
                return [];
            });
        return response;
    }

    async redact(options: RedactOptions): Promise<string> {
        const entities = await this.detectPiiEntities({
            text: options.text,
            languageCode: options.languageCode,
        });
        // Replace from the end of the string so earlier offsets stay valid.
        const sorted = [...entities].sort((a, b) => b.BeginOffset - a.BeginOffset);
        let redacted = options.text;
        for (const entity of sorted) {
            if (options.types && !options.types.includes(entity.Type)) continue;
            const replacement =
                options.maskCharacter !== undefined
                    ? options.maskCharacter.repeat(entity.EndOffset - entity.BeginOffset)
                    : `[${entity.Type}]`;
            redacted =
                redacted.slice(0, entity.BeginOffset) +
                replacement +
                redacted.slice(entity.EndOffset);
        }
        return redacted;
    }

    // Chain this redactor in front of any Endpoint class (OpenAI, GeminiAI, ...).
    // The returned RedactChain redacts the prompt/messages before the endpoint
    // observes them, so sensitive information never leaves the application.
    pipe(endpoint: RedactableEndpoint, options: Omit<RedactOptions, "text"> = {}): RedactChain {
        return new RedactChain(this, endpoint, options);
    }
}

export class RedactChain {
    constructor(
        private comprehend: Comprehend,
        private endpoint: RedactableEndpoint,
        private options: Omit<RedactOptions, "text"> = {}
    ) {}

    async chat(chatOptions: {
        prompt?: string;
        messages?: { content: string; [key: string]: any }[];
        [key: string]: any;
    }): Promise<any> {
        const redactedOptions = { ...chatOptions };
        if (chatOptions.prompt) {
            redactedOptions.prompt = await this.comprehend.redact({
                text: chatOptions.prompt,
                ...this.options,
            });
        }
        if (chatOptions.messages) {
            redactedOptions.messages = await Promise.all(
                chatOptions.messages.map(async (message) => ({
                    ...message,
                    content: await this.comprehend.redact({
                        text: message.content,
                        ...this.options,
                    }),
                }))
            );
        }
        return this.endpoint.chat(redactedOptions);
    }
}
