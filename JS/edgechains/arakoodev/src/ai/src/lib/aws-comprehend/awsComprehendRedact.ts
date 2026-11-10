import axios from "axios";

/**
 * AWS Comprehend PII Redaction
 *
 * Chains with existing EdgeChains Endpoint classes to detect and redact
 * Personally Identifiable Information (PII) from text using Amazon Comprehend.
 *
 * Usage:
 *   const redactor = new AWSComprehendRedact({ region: "us-east-1" });
 *   const cleaned = await redactor.redact("My name is John and I live in New York.");
 *   // => "My name is [NAME] and I live in [LOCATION]."
 *
 *   // Chain with an OpenAI endpoint:
 *   const openai = new OpenAI({ apiKey: "..." });
 *   const redactedPrompt = await redactor.redact(rawUserInput);
 *   const response = await openai.chat({ prompt: redactedPrompt });
 */

// AWS Comprehend PII entity types
export type PIIEntityType =
  | "PERSON"
  | "EMAIL"
  | "PHONE_NUMBER"
  | "DATE"
  | "LOCATION"
  | "ORGANIZATION"
  | "ACCOUNT_NUMBER"
  | "ADDRESS"
  | "ID_NUMBER"
  | "CREDIT_CARD"
  | "BANK_ACCOUNT"
  | "SSN";

export interface RedactionResult {
  /** The text with PII entities replaced by bracketed type labels. */
  redactedText: string;
  /** List of detected PII entities with their types and positions. */
  entities: PIIEntity[];
  /** The original input text. */
  originalText: string;
}

export interface PIIEntity {
  type: PIIEntityType;
  score: number;
  begin: number;
  end: number;
  /** The original text of the entity (useful for logging, not for output). */
  text: string;
}

export interface AWSComprehendRedactOptions {
  /** AWS region (default: "us-east-1"). */
  region?: string;
  /** AWS access key ID (or set AWS_ACCESS_KEY_ID env var). */
  accessKeyId?: string;
  /** AWS secret access key (or set AWS_SECRET_ACCESS_KEY env var). */
  secretAccessKey?: string;
  /** AWS session token for temporary credentials (or set AWS_SESSION_TOKEN). */
  sessionToken?: string;
  /**
   * Entity types to redact. Defaults to all supported PII types.
   * Pass a subset to redact only specific types.
   */
  entityTypes?: PIIEntityType[];
  /**
   * Custom replacement template. Default: "[{TYPE}]"
   * e.g. "[PERSON]" => "[PERSON]", "[EMAIL]" => "[EMAIL]"
   * Use "[REDACTED]" for a uniform replacement.
   */
  replacementTemplate?: string;
}

const DEFAULT_ENTITY_TYPES: PIIEntityType[] = [
  "PERSON",
  "EMAIL",
  "PHONE_NUMBER",
  "DATE",
  "LOCATION",
  "ORGANIZATION",
  "ACCOUNT_NUMBER",
  "ADDRESS",
  "ID_NUMBER",
  "CREDIT_CARD",
  "BANK_ACCOUNT",
  "SSN",
];

export class AWSComprehendRedact {
  private region: string;
  private accessKeyId: string;
  private secretAccessKey: string;
  private sessionToken: string;
  private entityTypes: PIIEntityType[];
  private replacementTemplate: string;

  constructor(options: AWSComprehendRedactOptions = {}) {
    this.region = options.region || process.env.AWS_REGION || "us-east-1";
    this.accessKeyId =
      options.accessKeyId || process.env.AWS_ACCESS_KEY_ID || "";
    this.secretAccessKey =
      options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || "";
    this.sessionToken =
      options.sessionToken || process.env.AWS_SESSION_TOKEN || "";
    this.entityTypes = options.entityTypes || DEFAULT_ENTITY_TYPES;
    this.replacementTemplate = options.replacementTemplate || "[{TYPE}]";

    this.checkKeys();
  }

  private checkKeys(): void {
    if (!this.accessKeyId) {
      console.error(
        "AWS access key ID is missing. Provide accessKeyId or set AWS_ACCESS_KEY_ID."
      );
    }
    if (!this.secretAccessKey) {
      console.error(
        "AWS secret access key is missing. Provide secretAccessKey or set AWS_SECRET_ACCESS_KEY."
      );
    }
  }

  /**
   * Detect and redact PII entities in the given text using Amazon Comprehend.
   *
   * @param text - The input text to scan for PII.
   * @returns A RedactionResult with the redacted text and detected entities.
   */
  async redact(text: string): Promise<RedactionResult> {
    if (!text || text.trim().length === 0) {
      return { redactedText: text, entities: [], originalText: text };
    }

    // Comprehend DetectPIIEntities has a 10,000 character limit per call.
    // For longer text, we chunk it and process each chunk.
    const chunks = this.chunkText(text, 9000);
    const allEntities: PIIEntity[] = [];
    let offset = 0;

    for (const chunk of chunks) {
      const entities = await this.detectPII(chunk);
      // Adjust entity positions to account for the chunk offset
      for (const entity of entities) {
        allEntities.push({
          ...entity,
          begin: entity.begin + offset,
          end: entity.end + offset,
        });
      }
      offset += chunk.length;
    }

    // Sort entities by begin position (descending) so we can replace
    // from the end of the string without shifting indices.
    allEntities.sort((a, b) => b.begin - a.begin);

    let redactedText = text;
    for (const entity of allEntities) {
      const replacement = this.replacementTemplate.replace(
        "{TYPE}",
        entity.type
      );
      redactedText =
        redactedText.slice(0, entity.begin) +
        replacement +
        redactedText.slice(entity.end);
    }

    return {
      redactedText,
      entities: allEntities.sort((a, b) => a.begin - b.begin),
      originalText: text,
    };
  }

  /**
   * Call the AWS Comprehend DetectPIIEntities API.
   */
  private async detectPII(text: string): Promise<PIIEntity[]> {
    const payload = {
      Text: text,
      LanguageCode: "en",
    };

    const url = `https://comprehend.${this.region}.amazonaws.com/detectpiientities`;

    // AWS SigV4 signing
    const signature = this.signRequest("POST", url, JSON.stringify(payload));

    const response = await axios.post(url, payload, {
      headers: {
        "Content-Type": "application/x-amz-json-1.0",
        "X-Amz-Target": "ComprehendWebService.DetectPiiEntities",
        Authorization: signature.authorization,
        ...(this.sessionToken
          ? { "X-Amz-Security-Token": this.sessionToken }
          : {}),
      },
      timeout: 30000,
    });

    const entities: PIIEntity[] = (response.data.Entities || []).map(
      (e: any) => ({
        type: e.Type as PIIEntityType,
        score: e.Score,
        begin: e.BeginOffset,
        end: e.EndOffset,
        text: text.slice(e.BeginOffset, e.EndOffset),
      })
    );

    // Filter to only the entity types we care about
    return entities.filter((e) => this.entityTypes.includes(e.type));
  }

  /**
   * Split text into chunks of at most `maxLen` characters,
   * trying to break at sentence boundaries.
   */
  private chunkText(text: string, maxLen: number): string[] {
    if (text.length <= maxLen) return [text];

    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      let end = Math.min(start + maxLen, text.length);

      // Try to break at a sentence boundary (. ! ?) within the last 20% of the chunk
      if (end < text.length) {
        const searchStart = Math.max(start, end - Math.floor(maxLen * 0.2));
        const segment = text.slice(searchStart, end);
        const lastPeriod = Math.max(
          segment.lastIndexOf(". "),
          segment.lastIndexOf("! "),
          segment.lastIndexOf("? ")
        );
        if (lastPeriod > 0) {
          end = searchStart + lastPeriod + 1;
        }
      }

      chunks.push(text.slice(start, end));
      start = end;
    }

    return chunks;
  }

  /**
   * AWS Signature Version 4 signing.
   * Implements the SigV4 algorithm for AWS API requests.
   */
  private signRequest(
    method: string,
    url: string,
    body: string
  ): { authorization: string } {
    const now = new Date();
    const amzDate = now
      .toISOString()
      .replace(/[:-]/g, "")
      .replace(/\.+$/, ""); // YYYYMMDDTHHMMSSZ
    const dateStamp = amzDate.slice(0, 8); // YYYYMMDD

    const service = "comprehend";
    const host = new URL(url).host;
    const canonicalUri = new URL(url).pathname;
    const canonicalQueryString = "";

    // Canonical headers
    const canonicalHeaders =
      `host:${host}\n` +
      `x-amz-date:${amzDate}\n` +
      `x-amz-target:ComprehendWebService.DetectPiiEntities\n` +
      `content-type:application/x-amz-json-1.0\n`;
    const signedHeaders =
      "content-type;host;x-amz-date;x-amz-target";

    const payloadHash = this.sha256Hex(body);
    const canonicalRequest = [
      method,
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join("\n");

    const credentialScope = `${dateStamp}/${this.region}/${service}/aws4_request`;
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      credentialScope,
      this.sha256Hex(canonicalRequest),
    ].join("\n");

    // Derive the signing key
    const kDate = this.hmacSHA256(
      `AWS4${this.secretAccessKey}`,
      dateStamp
    );
    const kRegion = this.hmacSHA256(kDate, this.region);
    const kService = this.hmacSHA256(kRegion, service);
    const kSigning = this.hmacSHA256(kService, "aws4_request");

    const signature = this.hmacSHA256Hex(kSigning, stringToSign);

    const authorization =
      `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, ` +
      `Signature=${signature}`;

    return { authorization };
  }

  // --- Crypto helpers (pure JS, no external deps) ---

  private sha256Hex(input: string): string {
    return this.sha256(input).toString("hex");
  }

  private hmacSHA256(key: string | Buffer, data: string): Buffer {
    // Simple HMAC-SHA256 using Node's crypto
    const crypto = require("crypto");
    return crypto.createHmac("sha256", key).update(data, "utf8").digest();
  }

  private hmacSHA256Hex(key: Buffer, data: string): string {
    const crypto = require("crypto");
    return crypto.createHmac("sha256", key).update(data, "utf8").digest("hex");
  }

  private sha256(input: string): Buffer {
    const crypto = require("crypto");
    return crypto.createHash("sha256").update(input, "utf8").digest();
  }
}
