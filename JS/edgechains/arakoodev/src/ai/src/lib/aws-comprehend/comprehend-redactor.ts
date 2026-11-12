import crypto from "node:crypto";

export type ComprehendPiiEntityType =
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
  | "ALL";

export interface ComprehendPiiEntity {
  Type: ComprehendPiiEntityType;
  Score: number;
  BeginOffset: number;
  EndOffset: number;
}

export interface ComprehendRedactorOptions {
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  region?: string;
  languageCode?: string;
  minScore?: number;
  entityTypes?: ComprehendPiiEntityType[];
  replacement?:
    | string
    | ((entity: ComprehendPiiEntity, text: string) => string);
  endpoint?: string;
  fetchFn?: typeof fetch;
}

interface RedactTextOptions {
  text: string;
  languageCode?: string;
  minScore?: number;
  entityTypes?: ComprehendPiiEntityType[];
  replacement?:
    | string
    | ((entity: ComprehendPiiEntity, text: string) => string);
}

interface MessageOption {
  role: string;
  content: string;
  name?: string;
}

const service = "comprehend";
const algorithm = "AWS4-HMAC-SHA256";

export class AwsComprehendRedactor {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  region: string;
  languageCode: string;
  minScore: number;
  entityTypes?: ComprehendPiiEntityType[];
  replacement: string | ((entity: ComprehendPiiEntity, text: string) => string);
  endpoint?: string;
  fetchFn: typeof fetch;

  constructor(options: ComprehendRedactorOptions = {}) {
    this.accessKeyId =
      options.accessKeyId || process.env.AWS_ACCESS_KEY_ID || "";
    this.secretAccessKey =
      options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || "";
    this.sessionToken = options.sessionToken || process.env.AWS_SESSION_TOKEN;
    this.region = options.region || process.env.AWS_REGION || "us-east-1";
    this.languageCode = options.languageCode || "en";
    this.minScore = options.minScore ?? 0;
    this.entityTypes = options.entityTypes;
    this.replacement =
      options.replacement || ((entity) => `[REDACTED_${entity.Type}]`);
    this.endpoint = options.endpoint;
    this.fetchFn = options.fetchFn || fetch;
  }

  async redactPrompt(prompt: string): Promise<string> {
    return this.redactText({ text: prompt });
  }

  async redactMessages<T extends MessageOption>(messages: T[]): Promise<T[]> {
    return Promise.all(
      messages.map(async (message) => ({
        ...message,
        content: await this.redactPrompt(message.content),
      })),
    );
  }

  async redactText(options: RedactTextOptions): Promise<string> {
    const text = options.text;
    const entities = await this.detectPiiEntities({
      text,
      languageCode: options.languageCode,
    });

    return this.redactDetectedEntities(text, entities, {
      minScore: options.minScore,
      entityTypes: options.entityTypes,
      replacement: options.replacement,
    });
  }

  async redactEndpointPrompt<T>(
    endpointCall: (options: T) => Promise<any>,
    options: T & { prompt?: string; messages?: MessageOption[] },
  ): Promise<any> {
    const redactedOptions = { ...options };
    if (redactedOptions.prompt) {
      redactedOptions.prompt = await this.redactPrompt(redactedOptions.prompt);
    }
    if (redactedOptions.messages) {
      redactedOptions.messages = await this.redactMessages(
        redactedOptions.messages,
      );
    }
    return endpointCall(redactedOptions);
  }

  redactDetectedEntities(
    text: string,
    entities: ComprehendPiiEntity[],
    options: Omit<RedactTextOptions, "text" | "languageCode"> = {},
  ): string {
    const minScore = options.minScore ?? this.minScore;
    const entityTypes = options.entityTypes ?? this.entityTypes;
    const replacement = options.replacement ?? this.replacement;
    const filteredEntities = entities
      .filter((entity) => entity.Score >= minScore)
      .filter(
        (entity) =>
          !entityTypes ||
          entityTypes.includes("ALL") ||
          entityTypes.includes(entity.Type),
      )
      .sort((a, b) => b.BeginOffset - a.BeginOffset);

    let redactedText = text;
    for (const entity of filteredEntities) {
      const originalValue = text.slice(entity.BeginOffset, entity.EndOffset);
      const replacementValue =
        typeof replacement === "function"
          ? replacement(entity, originalValue)
          : replacement;
      redactedText =
        redactedText.slice(0, entity.BeginOffset) +
        replacementValue +
        redactedText.slice(entity.EndOffset);
    }
    return redactedText;
  }

  async detectPiiEntities({
    text,
    languageCode,
  }: {
    text: string;
    languageCode?: string;
  }): Promise<ComprehendPiiEntity[]> {
    const body = JSON.stringify({
      Text: text,
      LanguageCode: languageCode || this.languageCode,
    });
    const endpoint =
      this.endpoint || `https://comprehend.${this.region}.amazonaws.com/`;
    const headers = this.createSignedHeaders(body, endpoint);
    const response = await this.fetchFn(endpoint, {
      method: "POST",
      headers,
      body,
    });
    const responseBody = await response.json();

    if (!response.ok) {
      throw new Error(
        `AWS Comprehend DetectPiiEntities failed with status ${response.status}: ${JSON.stringify(
          responseBody,
        )}`,
      );
    }

    return responseBody.Entities || [];
  }

  private createSignedHeaders(
    body: string,
    endpoint: string,
  ): Record<string, string> {
    if (!this.accessKeyId || !this.secretAccessKey) {
      throw new Error(
        "AWS credentials are required. Provide accessKeyId/secretAccessKey or set AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY.",
      );
    }

    const now = new Date();
    const amzDate = this.toAmzDate(now);
    const dateStamp = amzDate.slice(0, 8);
    const url = new URL(endpoint);
    const canonicalUri = url.pathname || "/";
    const canonicalQueryString = "";
    const payloadHash = this.sha256(body);
    const credentialScope = `${dateStamp}/${this.region}/${service}/aws4_request`;
    const baseHeaders: Record<string, string> = {
      "content-type": "application/x-amz-json-1.1",
      host: url.host,
      "x-amz-date": amzDate,
      "x-amz-target": "Comprehend_20171127.DetectPiiEntities",
    };

    if (this.sessionToken) {
      baseHeaders["x-amz-security-token"] = this.sessionToken;
    }

    const signedHeaders = Object.keys(baseHeaders).sort().join(";");
    const canonicalHeaders = Object.keys(baseHeaders)
      .sort()
      .map((key) => `${key}:${baseHeaders[key]}\n`)
      .join("");
    const canonicalRequest = [
      "POST",
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join("\n");
    const stringToSign = [
      algorithm,
      amzDate,
      credentialScope,
      this.sha256(canonicalRequest),
    ].join("\n");
    const signingKey = this.getSignatureKey(
      this.secretAccessKey,
      dateStamp,
      this.region,
      service,
    );
    const signature = crypto
      .createHmac("sha256", signingKey)
      .update(stringToSign)
      .digest("hex");

    return {
      ...baseHeaders,
      Authorization: `${algorithm} Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    };
  }

  private toAmzDate(date: Date): string {
    return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  }

  private sha256(value: string): string {
    return crypto.createHash("sha256").update(value, "utf8").digest("hex");
  }

  private hmac(key: Buffer | string, value: string): Buffer {
    return crypto.createHmac("sha256", key).update(value, "utf8").digest();
  }

  private getSignatureKey(
    key: string,
    dateStamp: string,
    regionName: string,
    serviceName: string,
  ): Buffer {
    const kDate = this.hmac(`AWS4${key}`, dateStamp);
    const kRegion = this.hmac(kDate, regionName);
    const kService = this.hmac(kRegion, serviceName);
    return this.hmac(kService, "aws4_request");
  }
}
