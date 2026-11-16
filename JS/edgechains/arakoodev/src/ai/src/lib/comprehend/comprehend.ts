import axios from "axios";
import crypto from "crypto";

interface AWSComprehendConstructionOptions {
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
}

interface PiiEntityResult {
    score: number;
    type: string;
    beginOffset: number;
    endOffset: number;
}

interface RedactionOptions {
    text: string;
    languageCode?: string;
    maskChar?: string;
}

interface RedactionResult {
    redactedText: string;
    entities: PiiEntityResult[];
}

interface DetectionResult {
    entities: PiiEntityResult[];
}

type PiiEntityType =
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
    | "MEDICAL_RECORD_NUMBER"
    | "HEALTH_PLAN_BENEFIT_NUMBER"
    | "DRUG_PRESCRIPTION_ID"
    | "MEDICAL_TEST_RESULT"
    | "MEDICAL_DEVICE_ID"
    | "DEPARTMENT_OF_DEFENSE_ID_NUMBER"
    | "US_PASSPORT_NUMBER"
    | "US_SOCIAL_SECURITY_NUMBER"
    | "INTERNATIONAL_BANK_ACCOUNT_NUMBER"
    | "SWIFT_CODE"
    | "IBAN_CODE"
    | "UK_UNIQUE_TAXPAYER_REFERENCE_NUMBER"
    | "IN_PAN"
    | "IN_AADHAAR"
    | "IN_VOTER_NUMBER"
    | "IN_PASSPORT"
    | "IN_DRIVING_LICENSE";

export class AWSComprehend {
    private accessKeyId: string;
    private secretAccessKey: string;
    private region: string;

    constructor(options: AWSComprehendConstructionOptions = {}) {
        this.accessKeyId = options.accessKeyId || process.env.AWS_ACCESS_KEY_ID || "";
        this.secretAccessKey = options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || "";
        this.region = options.region || process.env.AWS_REGION || "us-east-1";
        this.checkKeys();
    }

    private checkKeys(): void {
        if (!this.accessKeyId || !this.secretAccessKey) {
            console.error(
                "AWS credentials are missing. Please provide valid AWS credentials via constructor options or environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)."
            );
        }
    }

    private async signRequest(
        payload: string,
        service: string,
        host: string,
        amzTarget: string
    ): Promise<{ headers: Record<string, string>; url: string }> {
        const amzDate = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, "");
        const dateStamp = amzDate.substring(0, 8);
        const endpoint = `https://${host}`;
        const canonicalUri = "/";
        const payloadHash = crypto.createHash("sha256").update(payload).digest("hex");

        const canonicalHeaders = [
            `content-type:application/x-amz-json-1.1`,
            `host:${host}`,
            `x-amz-date:${amzDate}`,
            `x-amz-target:${amzTarget}`,
        ].join("\n") + "\n";

        const signedHeaders = "content-type;host;x-amz-date;x-amz-target";
        const canonicalRequest = [
            "POST",
            canonicalUri,
            "",
            canonicalHeaders,
            signedHeaders,
            payloadHash,
        ].join("\n");

        const credentialScope = `${dateStamp}/${this.region}/${service}/aws4_request`;
        const stringToSign = [
            "AWS4-HMAC-SHA256",
            amzDate,
            credentialScope,
            crypto.createHash("sha256").update(canonicalRequest).digest("hex"),
        ].join("\n");

        const sign = (key: Buffer, msg: string) =>
            crypto.createHmac("sha256", key).update(msg).digest();

        let signingKey = sign(
            sign(
                sign(
                    sign(Buffer.from("AWS4" + this.secretAccessKey), dateStamp),
                    this.region
                ),
                service
            ),
            "aws4_request"
        );

        const signature = crypto.createHmac("sha256", signingKey).update(stringToSign).digest("hex");

        const authorizationHeader =
            `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}, ` +
            `SignedHeaders=${signedHeaders}, Signature=${signature}`;

        return {
            url: endpoint,
            headers: {
                "Content-Type": "application/x-amz-json-1.1",
                "X-Amz-Date": amzDate,
                "X-Amz-Target": amzTarget,
                Authorization: authorizationHeader,
                Host: host,
            },
        };
    }

    async detectPiiEntities(
        text: string,
        languageCode: string = "en"
    ): Promise<DetectionResult> {
        const payload = JSON.stringify({
            Text: text,
            LanguageCode: languageCode,
        });

        const host = `comprehend.${this.region}.amazonaws.com`;
        const { url, headers } = await this.signRequest(
            payload,
            "comprehend",
            host,
            "Comprehend_20171127.DetectPiiEntities"
        );

        const response = await axios.post(url, payload, { headers }).catch((error) => {
            if (error.response) {
                console.error("AWS Comprehend error:", error.response.status, error.response.data);
            } else {
                console.error("AWS Comprehend request failed:", error.message);
            }
            throw error;
        });

        const entities: PiiEntityResult[] = (response.data.Entities || []).map(
            (entity: any) => ({
                score: entity.Score || 0,
                type: entity.Type || "UNKNOWN",
                beginOffset: entity.BeginOffset || 0,
                endOffset: entity.EndOffset || 0,
            })
        );

        return { entities };
    }

    async redactPii(options: RedactionOptions): Promise<RedactionResult> {
        const { entities } = await this.detectPiiEntities(
            options.text,
            options.languageCode || "en"
        );
        const maskChar = options.maskChar || "*";

        let redactedText = options.text;
        const sortedEntities = [...entities].sort((a, b) => b.beginOffset - a.beginOffset);

        for (const entity of sortedEntities) {
            const replacement = maskChar.repeat(entity.endOffset - entity.beginOffset);
            redactedText =
                redactedText.substring(0, entity.beginOffset) +
                replacement +
                redactedText.substring(entity.endOffset);
        }

        return { redactedText, entities };
    }

    async containsPii(text: string, languageCode: string = "en"): Promise<boolean> {
        const payload = JSON.stringify({
            Text: text,
            LanguageCode: languageCode,
        });

        const host = `comprehend.${this.region}.amazonaws.com`;
        const { url, headers } = await this.signRequest(
            payload,
            "comprehend",
            host,
            "Comprehend_20171127.ContainsPiiEntities"
        );

        const response = await axios.post(url, payload, { headers }).catch((error) => {
            if (error.response) {
                console.error("AWS Comprehend error:", error.response.status, error.response.data);
            } else {
                console.error("AWS Comprehend request failed:", error.message);
            }
            throw error;
        });

        return (response.data.Labels || []).length > 0;
    }
}

export type {
    AWSComprehendConstructionOptions,
    PiiEntityResult,
    RedactionOptions,
    RedactionResult,
    DetectionResult,
    PiiEntityType,
};
