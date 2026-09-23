import { createHash, createHmac } from "crypto";

export type ComprehendLanguageCode =
  | "en"
  | "es"
  | "fr"
  | "de"
  | "it"
  | "pt"
  | "ar"
  | "hi"
  | "ja"
  | "ko"
  | "zh"
  | "zh-TW";

export type ComprehendPiiType =
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
  Type: ComprehendPiiType;
  Score: number;
  BeginOffset: number;
  EndOffset: number;
}

export interface ComprehendClient {
  detectPiiEntities(options: {
    Text: string;
    LanguageCode: ComprehendLanguageCode;
  }): Promise<{ Entities: ComprehendPiiEntity[] }>;
}

export interface AWSComprehendCredentials {
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
}

export interface AWSComprehendClientOptions extends AWSComprehendCredentials {
  region?: string;
  endpoint?: string;
  fetch?: FetchLike;
  now?: () => Date;
}

export interface ComprehendRedactionOptions {
  languageCode?: ComprehendLanguageCode;
  minScore?: number;
  entityTypes?: ComprehendPiiType[];
  replacement?:
    | string
    | ((entity: ComprehendPiiEntity, value: string) => string);
  preserveLength?: boolean;
}

export interface ComprehendRedactionResult {
  text: string;
  entities: ComprehendPiiEntity[];
}

export interface MessageLike {
  role?: string;
  content: string;
  [key: string]: unknown;
}

interface FetchLike {
  (
    input: string,
    init: {
      method: string;
      headers: Record<string, string>;
      body: string;
    },
  ): Promise<{
    ok: boolean;
    status: number;
    statusText: string;
    text(): Promise<string>;
    json(): Promise<unknown>;
  }>;
}

interface PromptOptions {
  prompt?: string;
  messages?: MessageLike[];
  [key: string]: unknown;
}

export interface AWSComprehendRedactorOptions
  extends ComprehendRedactionOptions, AWSComprehendClientOptions {
  client?: ComprehendClient;
}

const DEFAULT_LANGUAGE: ComprehendLanguageCode = "en";
const DEFAULT_MIN_SCORE = 0.5;

export class AWSComprehendClient implements ComprehendClient {
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly sessionToken?: string;
  private readonly region: string;
  private readonly endpoint: string;
  private readonly fetcher: FetchLike;
  private readonly now: () => Date;

  constructor(options: AWSComprehendClientOptions = {}) {
    this.accessKeyId =
      options.accessKeyId || process.env.AWS_ACCESS_KEY_ID || "";
    this.secretAccessKey =
      options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || "";
    this.sessionToken = options.sessionToken || process.env.AWS_SESSION_TOKEN;
    this.region =
      options.region ||
      process.env.AWS_REGION ||
      process.env.AWS_DEFAULT_REGION ||
      "us-east-1";
    this.endpoint =
      options.endpoint || `https://comprehend.${this.region}.amazonaws.com`;
    this.fetcher = options.fetch || getGlobalFetch();
    this.now = options.now || (() => new Date());
  }

  async detectPiiEntities(options: {
    Text: string;
    LanguageCode: ComprehendLanguageCode;
  }): Promise<{ Entities: ComprehendPiiEntity[] }> {
    if (!this.accessKeyId || !this.secretAccessKey) {
      throw new Error(
        "AWS credentials are required. Provide accessKeyId and secretAccessKey or set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.",
      );
    }

    const body = JSON.stringify(options);
    const headers = this.signRequest(body);
    const response = await this.fetcher(this.endpoint, {
      method: "POST",
      headers,
      body,
    });

    if (!response.ok) {
      throw new Error(
        `AWS Comprehend DetectPiiEntities failed with ${response.status} ${response.statusText}: ${await response.text()}`,
      );
    }

    return (await response.json()) as { Entities: ComprehendPiiEntity[] };
  }

  private signRequest(payload: string): Record<string, string> {
    const url = new URL(this.endpoint);
    const amzDate = toAmzDate(this.now());
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = hash(payload);
    const host = url.host;
    const target = "Comprehend_20171127.DetectPiiEntities";
    const credentialScope = `${dateStamp}/${this.region}/comprehend/aws4_request`;

    const signedHeaderEntries: Array<[string, string]> = [
      ["content-type", "application/x-amz-json-1.1"],
      ["host", host],
      ["x-amz-content-sha256", payloadHash],
      ["x-amz-date", amzDate],
      ["x-amz-target", target],
    ];

    if (this.sessionToken) {
      signedHeaderEntries.push(["x-amz-security-token", this.sessionToken]);
    }

    const canonicalHeaders = signedHeaderEntries
      .map(([key, value]) => `${key}:${value.trim()}\n`)
      .join("");
    const signedHeaders = signedHeaderEntries.map(([key]) => key).join(";");
    const canonicalRequest = [
      "POST",
      url.pathname || "/",
      url.searchParams.toString(),
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join("\n");

    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      credentialScope,
      hash(canonicalRequest),
    ].join("\n");
    const signingKey = getSignatureKey(
      this.secretAccessKey,
      dateStamp,
      this.region,
      "comprehend",
    );
    const signature = hmacHex(signingKey, stringToSign);
    const authorization = `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/x-amz-json-1.1",
      Host: host,
      "X-Amz-Content-Sha256": payloadHash,
      "X-Amz-Date": amzDate,
      "X-Amz-Target": target,
      Authorization: authorization,
    };

    if (this.sessionToken) {
      headers["X-Amz-Security-Token"] = this.sessionToken;
    }

    return headers;
  }
}

export class AWSComprehendRedactor {
  private readonly client: ComprehendClient;
  private readonly defaults: Required<
    Pick<
      ComprehendRedactionOptions,
      "languageCode" | "minScore" | "preserveLength"
    >
  > &
    Pick<ComprehendRedactionOptions, "entityTypes" | "replacement">;

  constructor(options: AWSComprehendRedactorOptions = {}) {
    this.client = options.client || new AWSComprehendClient(options);
    this.defaults = {
      languageCode: options.languageCode || DEFAULT_LANGUAGE,
      minScore: options.minScore ?? DEFAULT_MIN_SCORE,
      entityTypes: options.entityTypes,
      replacement: options.replacement,
      preserveLength: options.preserveLength ?? false,
    };
  }

  async detectPii(
    text: string,
    options: ComprehendRedactionOptions = {},
  ): Promise<ComprehendPiiEntity[]> {
    const merged = this.mergeOptions(options);
    if (!text) {
      return [];
    }

    const response = await this.client.detectPiiEntities({
      Text: text,
      LanguageCode: merged.languageCode,
    });

    return response.Entities.filter((entity) => {
      const passesScore = entity.Score >= merged.minScore;
      const passesType =
        !merged.entityTypes ||
        merged.entityTypes.includes("ALL") ||
        merged.entityTypes.includes(entity.Type);
      return passesScore && passesType;
    }).sort(
      (a, b) => a.BeginOffset - b.BeginOffset || b.EndOffset - a.EndOffset,
    );
  }

  async redact(
    text: string,
    options: ComprehendRedactionOptions = {},
  ): Promise<ComprehendRedactionResult> {
    const merged = this.mergeOptions(options);
    const entities = await this.detectPii(text, merged);
    const safeEntities = withoutOverlaps(entities);
    let redacted = text;

    for (const entity of [...safeEntities].reverse()) {
      const value = redacted.slice(entity.BeginOffset, entity.EndOffset);
      const replacement = buildReplacement(entity, value, merged);
      redacted = `${redacted.slice(0, entity.BeginOffset)}${replacement}${redacted.slice(entity.EndOffset)}`;
    }

    return { text: redacted, entities: safeEntities };
  }

  async redactMessage<T extends MessageLike>(
    message: T,
    options: ComprehendRedactionOptions = {},
  ): Promise<T> {
    const result = await this.redact(message.content, options);
    return { ...message, content: result.text };
  }

  async redactMessages<T extends MessageLike>(
    messages: T[],
    options: ComprehendRedactionOptions = {},
  ): Promise<T[]> {
    return Promise.all(
      messages.map((message) => this.redactMessage(message, options)),
    );
  }

  async redactPromptOptions<T extends PromptOptions>(
    promptOptions: T,
    options: ComprehendRedactionOptions = {},
  ): Promise<T> {
    const redacted: PromptOptions = { ...promptOptions };

    if (typeof promptOptions.prompt === "string") {
      redacted.prompt = (await this.redact(promptOptions.prompt, options)).text;
    }

    if (promptOptions.messages) {
      redacted.messages = await this.redactMessages(
        promptOptions.messages,
        options,
      );
    }

    return redacted as T;
  }

  wrapChat<T extends { chat(options: PromptOptions): Promise<unknown> }>(
    endpoint: T,
  ): T {
    return {
      ...endpoint,
      chat: async (options: PromptOptions) =>
        endpoint.chat(await this.redactPromptOptions(options)),
    };
  }

  mapText(
    options: ComprehendRedactionOptions = {},
  ): (text: string) => Promise<string> {
    return async (text: string) => (await this.redact(text, options)).text;
  }

  async *redactStream(
    source: Iterable<string> | AsyncIterable<string>,
    options: ComprehendRedactionOptions = {},
  ): AsyncGenerator<string> {
    for await (const chunk of source) {
      yield (await this.redact(chunk, options)).text;
    }
  }

  private mergeOptions(
    options: ComprehendRedactionOptions,
  ): Required<
    Pick<
      ComprehendRedactionOptions,
      "languageCode" | "minScore" | "preserveLength"
    >
  > &
    Pick<ComprehendRedactionOptions, "entityTypes" | "replacement"> {
    return {
      languageCode: options.languageCode || this.defaults.languageCode,
      minScore: options.minScore ?? this.defaults.minScore,
      entityTypes: options.entityTypes || this.defaults.entityTypes,
      replacement: options.replacement || this.defaults.replacement,
      preserveLength: options.preserveLength ?? this.defaults.preserveLength,
    };
  }
}

function withoutOverlaps(
  entities: ComprehendPiiEntity[],
): ComprehendPiiEntity[] {
  const result: ComprehendPiiEntity[] = [];
  let lastEnd = -1;

  for (const entity of entities) {
    if (
      entity.BeginOffset >= lastEnd &&
      entity.EndOffset > entity.BeginOffset
    ) {
      result.push(entity);
      lastEnd = entity.EndOffset;
    }
  }

  return result;
}

function buildReplacement(
  entity: ComprehendPiiEntity,
  value: string,
  options: Required<
    Pick<
      ComprehendRedactionOptions,
      "languageCode" | "minScore" | "preserveLength"
    >
  > &
    Pick<ComprehendRedactionOptions, "entityTypes" | "replacement">,
): string {
  if (typeof options.replacement === "function") {
    return options.replacement(entity, value);
  }

  if (options.preserveLength) {
    return (options.replacement || "*")
      .repeat(value.length)
      .slice(0, value.length);
  }

  return options.replacement || `[REDACTED_${entity.Type}]`;
}

function getGlobalFetch(): FetchLike {
  if (!globalThis.fetch) {
    throw new Error(
      "A fetch implementation is required to call AWS Comprehend.",
    );
  }

  return globalThis.fetch as unknown as FetchLike;
}

function toAmzDate(date: Date): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function hash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac("sha256", key).update(value, "utf8").digest();
}

function hmacHex(key: Buffer, value: string): string {
  return createHmac("sha256", key).update(value, "utf8").digest("hex");
}

function getSignatureKey(
  key: string,
  dateStamp: string,
  region: string,
  service: string,
): Buffer {
  const kDate = hmac(`AWS4${key}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}
