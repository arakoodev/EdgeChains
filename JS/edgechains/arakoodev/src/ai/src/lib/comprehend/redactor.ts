import { createHash, createHmac } from "crypto";

export type PIIEntity = {
  type: string;
  beginOffset: number;
  endOffset: number;
  score: number;
};

export type RedactionResult = {
  redactedText: string;
  entities: PIIEntity[];
};

export interface ComprehendRedactorOptions {
  region?: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
  languageCode?: string;
  /**
   * "placeholder" replaces each PII span with [TYPE],
   * "asterisk" replaces it with same-length ****
   */
  maskStyle?: "placeholder" | "asterisk";
  /**
   * Injectable fetch implementation (used by tests).
   * Defaults to globalThis.fetch.
   */
  fetchImpl?: typeof fetch;
}

interface DetectPiiEntitiesResponse {
  Entities: Array<{
    Score: number;
    Type: string;
    BeginOffset: number;
    EndOffset: number;
  }>;
}

const SERVICE = "comprehend";
const TARGET = "Comprehend_20171127.DetectPiiEntities";

const sha256Hex = (data: string): string =>
  createHash("sha256").update(data, "utf8").digest("hex");

const hmac = (key: Buffer | string, data: string): Buffer =>
  createHmac("sha256", key).update(data, "utf8").digest();

/**
 * Redacts personally identifiable information from prompts using
 * Amazon Comprehend DetectPiiEntities.
 *
 * Can be chained with any AI client exposing `chat()` via {@link withPIIRedaction}.
 */
export class ComprehendRedactor {
  private region: string;
  private accessKeyId: string;
  private secretAccessKey: string;
  private languageCode: string;
  private maskStyle: "placeholder" | "asterisk";
  private fetchImpl: typeof fetch;

  constructor(options: ComprehendRedactorOptions = {}) {
    this.region =
      options.region ||
      process.env.AWS_REGION ||
      process.env.AWS_DEFAULT_REGION ||
      "";
    this.accessKeyId =
      options.credentials?.accessKeyId || process.env.AWS_ACCESS_KEY_ID || "";
    this.secretAccessKey =
      options.credentials?.secretAccessKey ||
      process.env.AWS_SECRET_ACCESS_KEY ||
      "";
    this.languageCode = options.languageCode || "en";
    this.maskStyle = options.maskStyle || "placeholder";
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
  }

  private isConfigured(): boolean {
    return Boolean(this.region && this.accessKeyId && this.secretAccessKey);
  }

  private signedHeaders(body: string): Record<string, string> {
    if (!this.isConfigured()) {
      throw new Error(
        "AWS credentials are missing. Provide region/accessKeyId/secretAccessKey or set AWS_REGION, AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.",
      );
    }
    const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    const host = `${SERVICE}.${this.region}.amazonaws.com`;
    const payloadHash = sha256Hex(body);

    const canonicalHeaders =
      `content-type:application/x-amz-json-1.1\n` +
      `host:${host}\n` +
      `x-amz-date:${amzDate}\n` +
      `x-amz-target:${TARGET}\n`;
    const signedHeadersList = "content-type;host;x-amz-date;x-amz-target";

    const canonicalRequest = [
      "POST",
      "/",
      "",
      canonicalHeaders,
      signedHeadersList,
      payloadHash,
    ].join("\n");

    const scope = `${dateStamp}/${this.region}/${SERVICE}/aws4_request`;
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      scope,
      sha256Hex(canonicalRequest),
    ].join("\n");

    const kDate = hmac(`AWS4${this.secretAccessKey}`, dateStamp);
    const kRegion = hmac(kDate, this.region);
    const kService = hmac(kRegion, SERVICE);
    const kSigning = hmac(kService, "aws4_request");
    const signature = createHmac("sha256", kSigning)
      .update(stringToSign, "utf8")
      .digest("hex");

    return {
      "Content-Type": "application/x-amz-json-1.1",
      Host: host,
      "X-Amz-Date": amzDate,
      "X-Amz-Target": TARGET,
      Authorization: `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${scope}, SignedHeaders=${signedHeadersList}, Signature=${signature}`,
    };
  }

  /** Calls Comprehend DetectPiiEntities and returns normalized entities. */
  async detect(text: string): Promise<PIIEntity[]> {
    const body = JSON.stringify({
      Text: text,
      LanguageCode: this.languageCode,
    });
    const host = `${SERVICE}.${this.region}.amazonaws.com`;
    const response = await this.fetchImpl(`https://${host}/`, {
      method: "POST",
      headers: this.signedHeaders(body),
      body,
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(
        `Comprehend DetectPiiEntities failed (${response.status}): ${detail}`,
      );
    }
    const parsed = (await response.json()) as DetectPiiEntitiesResponse;
    return (parsed.Entities || []).map((entity) => ({
      type: entity.Type,
      beginOffset: entity.BeginOffset,
      endOffset: entity.EndOffset,
      score: entity.Score,
    }));
  }

  /** Masks every detected PII span and returns the sanitized text. */
  async redact(text: string): Promise<RedactionResult> {
    const entities = await this.detect(text);
    // Replace from the end so earlier offsets stay valid.
    const sorted = [...entities].sort((a, b) => b.beginOffset - a.beginOffset);
    let redactedText = text;
    for (const entity of sorted) {
      const replacement =
        this.maskStyle === "asterisk"
          ? "*".repeat(Math.max(entity.endOffset - entity.beginOffset, 1))
          : `[${entity.type}]`;
      redactedText =
        redactedText.slice(0, entity.beginOffset) +
        replacement +
        redactedText.slice(entity.endOffset);
    }
    return { redactedText, entities };
  }
}

type ChatCapable = {
  chat: (options: any) => Promise<any>;
};

/**
 * Chains a PII redactor in front of any client exposing `chat()`.
 * Every prompt is sanitized before reaching the underlying AI endpoint.
 */
export function withPIIRedaction<C extends ChatCapable>(
  client: C,
  redactor: ComprehendRedactor,
): C {
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop !== "chat") {
        return Reflect.get(target, prop, receiver);
      }
      return async (chatOptions: any) => {
        if (chatOptions && typeof chatOptions.prompt === "string") {
          const { redactedText } = await redactor.redact(chatOptions.prompt);
          return target.chat({ ...chatOptions, prompt: redactedText });
        }
        return target.chat(chatOptions);
      };
    },
  });
}
