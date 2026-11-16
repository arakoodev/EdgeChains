import axios from "axios";
import { createHash, createHmac } from "node:crypto";

/**
 * Amazon Comprehend PII redaction utility.
 *
 * Wraps the `DetectPiiEntities` API directly (no AWS SDK dependency) and
 * redacts the detected personally identifiable information from the input
 * text. Refer to the AWS documentation for the full entity list:
 * https://docs.aws.amazon.com/comprehend/latest/APIReference/API_DetectPiiEntities.html
 */

export type PiiEntityType =
    | "BANK_ACCOUNT_NUMBER"
    | "BANK_ROUTING"
    | "CREDIT_DEBIT_NUMBER"
    | "CREDIT_DEBIT_CVV"
    | "CREDIT_DEBIT_EXPIRY"
    | "PIN"
    | "EMAIL"
    | "ADDRESS"
    | "NAME"
    | "PHONE"
    | "SSN"
    | "DATE_TIME"
    | "PASSPORT_NUMBER"
    | "DRIVER_ID"
    | "URL"
    | "AGE"
    | "USERNAME"
    | "PASSWORD"
    | "AWS_ACCESS_KEY"
    | "AWS_SECRET_KEY"
    | "IP_ADDRESS"
    | "MAC_ADDRESS"
    | "ALL"
    | "LICENSE_PLATE"
    | "VEHICLE_IDENTIFICATION_NUMBER"
    | "UK_NATIONAL_INSURANCE_NUMBER"
    | "CA_SOCIAL_INSURANCE_NUMBER"
    | "US_INDIVIDUAL_TAX_IDENTIFICATION_NUMBER"
    | "UK_UNIQUE_TAXPAYER_REFERENCE_NUMBER"
    | "IN_PERMANENT_ACCOUNT_NUMBER"
    | "IN_NREGA"
    | "INTERNATIONAL_BANK_ACCOUNT_NUMBER"
    | "SWIFT_CODE"
    | "UK_NATIONAL_HEALTH_SERVICE_NUMBER"
    | "CA_HEALTH_NUMBER"
    | "IN_AADHAAR"
    | "IN_VOTER_NUMBER";

export interface ComprehendConstructionOptions {
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
}

export interface DetectedPiiEntity {
    type: PiiEntityType;
    score: number;
    beginOffset: number;
    endOffset: number;
    text: string;
}

export interface RedactionResult {
    redactedText: string;
    entities: DetectedPiiEntity[];
}

/**
 * A minimal AWS Signature Version 4 signer used to call Comprehend's REST
 * API without pulling in the AWS SDK.
 */
function signRequest(
    method: string,
    host: string,
    canonicalUri: string,
    payload: string,
    region: string,
    service: string,
    accessKeyId: string,
    secretAccessKey: string,
    sessionToken?: string
): Record<string, string> {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);

    const canonicalQuerystring = "";
    const canonicalHeaders = `content-type:application/x-amz-json-1.1\nhost:${host}\nx-amz-date:${amzDate}\nx-amz-target:Comprehend_20171127.DetectPiiEntities\n`;
    const signedHeaders = "content-type;host;x-amz-date;x-amz-target";

    const payloadHash = createHash("sha256").update(payload).digest("hex");
    const canonicalRequest = [method, canonicalUri, canonicalQuerystring, canonicalHeaders, signedHeaders, payloadHash].join("\n");

    const algorithm = "AWS4-HMAC-SHA256";
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = [algorithm, amzDate, credentialScope, createHash("sha256").update(canonicalRequest).digest("hex")].join("\n");

    const hmac = (key: Buffer, data: string) => createHmac("sha256", key).update(data).digest();
    const kDate = hmac(Buffer.from(`AWS4${secretAccessKey}`, "utf8"), dateStamp);
    const kRegion = hmac(kDate, region);
    const kService = hmac(kRegion, service);
    const kSigning = hmac(kService, "aws4_request");
    const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");

    const authorization = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const headers: Record<string, string> = {
        "content-type": "application/x-amz-json-1.1",
        host,
        "x-amz-date": amzDate,
        "x-amz-target": "Comprehend_20171127.DetectPiiEntities",
        authorization,
    };
    if (sessionToken) {
        headers["x-amz-security-token"] = sessionToken;
    }
    return headers;
}

export class Comprehend {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
    host: string;

    constructor(options: ComprehendConstructionOptions) {
        this.region = options.region || process.env.AWS_REGION || "us-east-1";
        this.accessKeyId = options.accessKeyId || process.env.AWS_ACCESS_KEY_ID || "";
        this.secretAccessKey = options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || "";
        this.sessionToken = options.sessionToken || process.env.AWS_SESSION_TOKEN || "";
        this.host = `comprehend.${this.region}.amazonaws.com`;
        this.checkKeys();
    }

    private checkKeys(): void {
        if (!this.accessKeyId || !this.secretAccessKey) {
            console.warn(
                "AWS credentials are missing. Please provide accessKeyId and secretAccessKey, or set AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY in your .env file."
            );
        }
    }

    private validateText(text: string): void {
        if (text.length < 1 || text.length > 100000) {
            throw new Error("text must be between 1 and 100000 UTF-8 bytes");
        }
    }

    async detectPii(text: string, languageCode: "en" | "es" = "en"): Promise<DetectedPiiEntity[]> {
        this.validateText(text);
        const payload = JSON.stringify({
            Text: text,
            LanguageCode: languageCode,
        });

        const headers = signRequest(
            "POST",
            this.host,
            "/",
            payload,
            this.region,
            "comprehend",
            this.accessKeyId,
            this.secretAccessKey,
            this.sessionToken
        );

        const response = await axios.post(`https://${this.host}/`, payload, { headers });
        return (response.data.Entities || []).map((e: any) => ({
            type: e.Type as PiiEntityType,
            score: e.Score,
            beginOffset: e.BeginOffset,
            endOffset: e.EndOffset,
            text: text.slice(e.BeginOffset, e.EndOffset),
        }));
    }

    async redactPii(
        text: string,
        languageCode: "en" | "es" = "en",
        mask: string = "[REDACTED]"
    ): Promise<RedactionResult> {
        const entities = await this.detectPii(text, languageCode);
        // Sort descending by begin offset so slicing from the end keeps offsets valid.
        const sorted = [...entities].sort((a, b) => b.beginOffset - a.beginOffset);
        let redactedText = text;
        for (const entity of sorted) {
            redactedText =
                redactedText.slice(0, entity.beginOffset) + mask + redactedText.slice(entity.endOffset);
        }
        return { redactedText, entities };
    }
}
