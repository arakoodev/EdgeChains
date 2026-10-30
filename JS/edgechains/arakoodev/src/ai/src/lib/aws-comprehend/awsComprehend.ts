import axios from "axios";
import crypto from "crypto";

interface AWSComprehendConstructionOptions {
    accessKeyId?: string;
    secretAccessKey?: string;
    region?: string;
}

interface PiiEntity {
    type: string;
    beginOffset: number;
    endOffset: number;
    score: number;
}

interface DetectPiiResponse {
    Entities: PiiEntity[];
}

export class AWSComprehend {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;

    constructor(options: AWSComprehendConstructionOptions) {
        this.accessKeyId = options.accessKeyId || process.env.AWS_ACCESS_KEY_ID || "";
        this.secretAccessKey = options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || "";
        this.region = options.region || process.env.AWS_REGION || "us-east-1";
    }

    private signRequest(method: string, url: string, body: string, headers: Record<string, string>): Record<string, string> {
        const service = "comprehend";
        const host = `comprehend.${this.region}.amazonaws.com`;
        const now = new Date();
        const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
        const dateStamp = amzDate.slice(0, 8);

        const canonicalHeaders = Object.keys(headers)
            .sort()
            .map((k) => `${k.toLowerCase()}:${headers[k].trim()}\n`)
            .join("");
        const signedHeaders = Object.keys(headers).map((k) => k.toLowerCase()).sort().join(";");

        const payloadHash = crypto.createHash("sha256").update(body).digest("hex");
        const canonicalRequest = [method, "/", "", canonicalHeaders, signedHeaders, payloadHash].join("\n");

        const credentialScope = `${dateStamp}/${this.region}/${service}/aws4_request`;
        const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, crypto.createHash("sha256").update(canonicalRequest).digest("hex")].join("\n");

        const signingKey = this.getSigningKey(dateStamp);
        const signature = crypto.createHmac("sha256", signingKey).update(stringToSign).digest("hex");

        return {
            ...headers,
            "x-amz-date": amzDate,
            Authorization: `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
        };
    }

    private getSigningKey(dateStamp: string): Buffer {
        const kDate = crypto.createHmac("sha256", `AWS4${this.secretAccessKey}`).update(dateStamp).digest();
        const kRegion = crypto.createHmac("sha256", kDate).update(this.region).digest();
        const kService = crypto.createHmac("sha256", kRegion).update("comprehend").digest();
        return crypto.createHmac("sha256", kService).update("aws4_request").digest();
    }

    async detectPiiEntities(text: string, languageCode: string = "en"): Promise<PiiEntity[]> {
        const body = JSON.stringify({ Text: text, LanguageCode: languageCode });
        const headers: Record<string, string> = {
            "Content-Type": "application/x-amz-json-1.1",
            "X-Amz-Target": "Comprehend_20171127.DetectPiiEntities",
            Host: `comprehend.${this.region}.amazonaws.com`,
        };
        const signedHeaders = this.signRequest("POST", `https://comprehend.${this.region}.amazonaws.com/`, body, headers);

        const response = await axios.post(`https://comprehend.${this.region}.amazonaws.com/`, body, {
            headers: signedHeaders,
        });
        return (response.data as DetectPiiResponse).Entities || [];
    }

    async redact(text: string, languageCode: string = "en"): Promise<string> {
        const entities = await this.detectPiiEntities(text, languageCode);
        // Sort by offset descending to replace without shifting indices
        const sorted = [...entities].sort((a, b) => b.beginOffset - a.beginOffset);
        let result = text;
        for (const entity of sorted) {
            const replacement = `[${entity.type}]`;
            result = result.slice(0, entity.beginOffset) + replacement + result.slice(entity.endOffset);
        }
        return result;
    }
}

// Chainable wrapper for endpoints
export class RedactComprehend {
    comprehend: AWSComprehend;
    endpoint: any;

    constructor(endpoint: any, comprehend?: AWSComprehend) {
        this.endpoint = endpoint;
        this.comprehend = comprehend || new AWSComprehend({});
    }

    async chat(options: { prompt: string; [key: string]: any }): Promise<any> {
        const redactedPrompt = await this.comprehend.redact(options.prompt);
        return this.endpoint.chat({ ...options, prompt: redactedPrompt });
    }
}
