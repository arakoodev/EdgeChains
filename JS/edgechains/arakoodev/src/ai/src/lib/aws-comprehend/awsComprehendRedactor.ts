import axios from "axios";
import { createHash, createHmac } from "crypto";

type AwsCredentials = {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
};

type AwsComprehendRedactorOptions = {
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
    region?: string;
    languageCode?: string;
    replacement?: string;
    endpoint?: string;
};

type PiiEntity = {
    Type: string;
    Score: number;
    BeginOffset: number;
    EndOffset: number;
};

type MessageOption = {
    role: string;
    content: string;
    name?: string;
};

type PromptOptions = {
    prompt?: string;
    messages?: MessageOption[];
    [key: string]: unknown;
};

type SignedHeaders = {
    Authorization: string;
    "Content-Type": string;
    Host: string;
    "X-Amz-Date": string;
    "X-Amz-Target": string;
    "X-Amz-Security-Token"?: string;
};

const SERVICE = "comprehend";
const ALGORITHM = "AWS4-HMAC-SHA256";

export class AwsComprehendRedactor {
    private credentials: AwsCredentials;
    private region: string;
    private languageCode: string;
    private replacement: string;
    private endpoint: string;

    constructor(options: AwsComprehendRedactorOptions = {}) {
        this.region = options.region || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
        this.languageCode = options.languageCode || "en";
        this.replacement = options.replacement || "[REDACTED]";
        this.endpoint = options.endpoint || `https://comprehend.${this.region}.amazonaws.com`;
        this.credentials = {
            accessKeyId: options.accessKeyId || process.env.AWS_ACCESS_KEY_ID || "",
            secretAccessKey: options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || "",
            sessionToken: options.sessionToken || process.env.AWS_SESSION_TOKEN,
        };

        if (!this.credentials.accessKeyId || !this.credentials.secretAccessKey) {
            console.error(
                "AWS credentials are missing. Provide accessKeyId and secretAccessKey or set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY."
            );
        }
    }

    async detectPiiEntities(text: string): Promise<PiiEntity[]> {
        if (!text) return [];

        const body = JSON.stringify({
            LanguageCode: this.languageCode,
            Text: text,
        });
        const headers = this.createSignedHeaders(body, "Comprehend_20171127.DetectPiiEntities");

        const response = await axios.post(this.endpoint, body, {
            headers,
        });

        return response.data.Entities || [];
    }

    async redactText(text: string): Promise<string> {
        const entities = await this.detectPiiEntities(text);
        return this.applyRedactions(text, entities);
    }

    async redactPrompt(prompt: string): Promise<string> {
        return this.redactText(prompt);
    }

    async redactChatOptions<T extends PromptOptions>(chatOptions: T): Promise<T> {
        const redactedOptions = { ...chatOptions };

        if (typeof redactedOptions.prompt === "string") {
            redactedOptions.prompt = await this.redactText(redactedOptions.prompt);
        }

        if (Array.isArray(redactedOptions.messages)) {
            redactedOptions.messages = await Promise.all(
                redactedOptions.messages.map(async (message) => ({
                    ...message,
                    content: await this.redactText(message.content),
                }))
            );
        }

        return redactedOptions;
    }

    private applyRedactions(text: string, entities: PiiEntity[]): string {
        const sortedEntities = [...entities].sort((a, b) => b.BeginOffset - a.BeginOffset);

        return sortedEntities.reduce((redactedText, entity) => {
            if (entity.BeginOffset < 0 || entity.EndOffset > redactedText.length) {
                return redactedText;
            }

            return (
                redactedText.slice(0, entity.BeginOffset) +
                this.replacement +
                redactedText.slice(entity.EndOffset)
            );
        }, text);
    }

    private createSignedHeaders(body: string, target: string): SignedHeaders {
        const now = new Date();
        const amzDate = this.toAmzDate(now);
        const dateStamp = amzDate.slice(0, 8);
        const host = new URL(this.endpoint).host;
        const payloadHash = this.sha256(body);
        const canonicalHeaderEntries = [
            ["content-type", "application/x-amz-json-1.1"],
            ["host", host],
            ["x-amz-date", amzDate],
        ];

        if (this.credentials.sessionToken) {
            canonicalHeaderEntries.push(["x-amz-security-token", this.credentials.sessionToken]);
        }

        canonicalHeaderEntries.push(["x-amz-target", target]);

        const canonicalHeaders = canonicalHeaderEntries
            .map(([name, value]) => `${name}:${value}\n`)
            .join("");
        const signedHeaders = canonicalHeaderEntries.map(([name]) => name).join(";");
        const canonicalRequest = [
            "POST",
            "/",
            "",
            canonicalHeaders,
            signedHeaders,
            payloadHash,
        ].join("\n");
        const credentialScope = `${dateStamp}/${this.region}/${SERVICE}/aws4_request`;
        const stringToSign = [
            ALGORITHM,
            amzDate,
            credentialScope,
            this.sha256(canonicalRequest),
        ].join("\n");
        const signingKey = this.getSignatureKey(dateStamp);
        const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
        const authorizationHeader = `${ALGORITHM} Credential=${this.credentials.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
        const headers: SignedHeaders = {
            Authorization: authorizationHeader,
            "Content-Type": "application/x-amz-json-1.1",
            Host: host,
            "X-Amz-Date": amzDate,
            "X-Amz-Target": target,
        };

        if (this.credentials.sessionToken) {
            headers["X-Amz-Security-Token"] = this.credentials.sessionToken;
        }

        return headers;
    }

    private getSignatureKey(dateStamp: string): Buffer {
        const kDate = createHmac("sha256", `AWS4${this.credentials.secretAccessKey}`)
            .update(dateStamp)
            .digest();
        const kRegion = createHmac("sha256", kDate).update(this.region).digest();
        const kService = createHmac("sha256", kRegion).update(SERVICE).digest();
        return createHmac("sha256", kService).update("aws4_request").digest();
    }

    private sha256(value: string): string {
        return createHash("sha256").update(value, "utf8").digest("hex");
    }

    private toAmzDate(date: Date): string {
        return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
    }
}
