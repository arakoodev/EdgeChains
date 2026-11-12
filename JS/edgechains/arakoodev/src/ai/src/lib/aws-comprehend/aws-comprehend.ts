import { createHash, createHmac } from "crypto";

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

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
  Score: number;
  Type: ComprehendPiiEntityType;
  BeginOffset: number;
  EndOffset: number;
}

export interface DetectPiiEntitiesResponse {
  Entities: ComprehendPiiEntity[];
}

export interface AWSComprehendPIIRedactorOptions {
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  endpoint?: string;
  languageCode?: string;
  minScore?: number;
  entityTypes?: ComprehendPiiEntityType[];
  replacement?: string;
  fetch?: FetchLike;
  now?: () => Date;
}

export interface RedactTextOptions {
  languageCode?: string;
  minScore?: number;
  entityTypes?: ComprehendPiiEntityType[];
  replacement?: string;
}

export interface ObserverLike<T> {
  next: (value: T) => void;
  error?: (error: unknown) => void;
  complete?: () => void;
}

export interface ObservableLike<T> {
  subscribe: (
    observer: ObserverLike<T> | ((value: T) => void),
  ) => { unsubscribe?: () => void } | void;
}

interface MessageLike {
  content?: string;
  [key: string]: any;
}

interface ChatOptionsLike {
  prompt?: string;
  messages?: MessageLike[];
  [key: string]: any;
}

const SERVICE = "comprehend";
const TARGET = "Comprehend_20171127.DetectPiiEntities";
const CONTENT_TYPE = "application/x-amz-json-1.1";

export class AWSComprehendPIIRedactor {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  endpoint: string;
  languageCode: string;
  minScore: number;
  entityTypes?: ComprehendPiiEntityType[];
  replacement: string;
  fetch: FetchLike;
  now: () => Date;

  constructor(options: AWSComprehendPIIRedactorOptions = {}) {
    this.region = options.region || process.env.AWS_REGION || "us-east-1";
    this.accessKeyId =
      options.accessKeyId || process.env.AWS_ACCESS_KEY_ID || "";
    this.secretAccessKey =
      options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || "";
    this.sessionToken = options.sessionToken || process.env.AWS_SESSION_TOKEN;
    this.endpoint =
      options.endpoint || `https://${SERVICE}.${this.region}.amazonaws.com`;
    this.languageCode = options.languageCode || "en";
    this.minScore = options.minScore ?? 0;
    this.entityTypes = options.entityTypes;
    this.replacement = options.replacement || "[REDACTED_{type}]";
    this.fetch = options.fetch || globalThis.fetch.bind(globalThis);
    this.now = options.now || (() => new Date());
  }

  async detectPiiEntities(
    text: string,
    options: Pick<RedactTextOptions, "languageCode"> = {},
  ): Promise<DetectPiiEntitiesResponse> {
    if (!this.accessKeyId || !this.secretAccessKey) {
      throw new Error(
        "AWS credentials are required for Comprehend PII redaction",
      );
    }

    const body = JSON.stringify({
      Text: text,
      LanguageCode: options.languageCode || this.languageCode,
    });
    const headers = this.createSignedHeaders(body);
    const response = await this.fetch(this.endpoint, {
      method: "POST",
      headers,
      body,
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(
        `AWS Comprehend request failed: ${response.status} ${message}`,
      );
    }

    return (await response.json()) as DetectPiiEntitiesResponse;
  }

  async redactText(
    text: string,
    options: RedactTextOptions = {},
  ): Promise<string> {
    const response = await this.detectPiiEntities(text, options);
    const minScore = options.minScore ?? this.minScore;
    const entityTypes = options.entityTypes || this.entityTypes;
    const entities = response.Entities.filter((entity) => {
      const passesScore = entity.Score >= minScore;
      const passesType =
        !entityTypes ||
        entityTypes.includes("ALL") ||
        entityTypes.includes(entity.Type);
      return passesScore && passesType;
    }).sort((a, b) => b.BeginOffset - a.BeginOffset);

    let redacted = text;
    for (const entity of entities) {
      const replacement = this.formatReplacement(
        entity,
        options.replacement || this.replacement,
      );
      redacted =
        redacted.slice(0, entity.BeginOffset) +
        replacement +
        redacted.slice(entity.EndOffset);
    }
    return redacted;
  }

  async chain<T>(
    prompt: string,
    next: (redactedPrompt: string) => Promise<T> | T,
    options: RedactTextOptions = {},
  ): Promise<T> {
    const redactedPrompt = await this.redactText(prompt, options);
    return next(redactedPrompt);
  }

  redactObservable(
    source: ObservableLike<string>,
    options: RedactTextOptions = {},
  ): ObservableLike<string> {
    return {
      subscribe: (observerOrNext) => {
        const observer = toObserver(observerOrNext);
        let pending = 0;
        let completed = false;
        const maybeComplete = () => {
          if (completed && pending === 0) {
            observer.complete?.();
          }
        };

        return source.subscribe({
          next: (value) => {
            pending += 1;
            this.redactText(value, options)
              .then((redacted) => observer.next(redacted))
              .catch((error) => observer.error?.(error))
              .finally(() => {
                pending -= 1;
                maybeComplete();
              });
          },
          error: (error) => observer.error?.(error),
          complete: () => {
            completed = true;
            maybeComplete();
          },
        });
      },
    };
  }

  private createSignedHeaders(body: string): Record<string, string> {
    const date = this.now();
    const amzDate = toAmzDate(date);
    const dateStamp = amzDate.slice(0, 8);
    const host = new URL(this.endpoint).host;
    const payloadHash = sha256Hex(body);
    const headers: Record<string, string> = {
      "content-type": CONTENT_TYPE,
      host,
      "x-amz-date": amzDate,
      "x-amz-target": TARGET,
    };

    if (this.sessionToken) {
      headers["x-amz-security-token"] = this.sessionToken;
    }

    const signedHeaderNames = Object.keys(headers).sort();
    const canonicalHeaders = signedHeaderNames
      .map((name) => `${name}:${headers[name]}`)
      .join("\n");
    const signedHeaders = signedHeaderNames.join(";");
    const canonicalRequest = [
      "POST",
      "/",
      "",
      `${canonicalHeaders}\n`,
      signedHeaders,
      payloadHash,
    ].join("\n");
    const credentialScope = `${dateStamp}/${this.region}/${SERVICE}/aws4_request`;
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      credentialScope,
      sha256Hex(canonicalRequest),
    ].join("\n");
    const signature = getSignatureKey(
      this.secretAccessKey,
      dateStamp,
      this.region,
      SERVICE,
    )
      .update(stringToSign)
      .digest("hex");

    return {
      ...headers,
      Authorization: `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    };
  }

  private formatReplacement(
    entity: ComprehendPiiEntity,
    replacement: string,
  ): string {
    return replacement.replace("{type}", entity.Type);
  }
}

export class ComprehendRedactionMiddleware {
  redactor: AWSComprehendPIIRedactor;

  constructor(redactor: AWSComprehendPIIRedactor) {
    this.redactor = redactor;
  }

  async redactChatOptions<T extends ChatOptionsLike>(
    options: T,
    redactOptions: RedactTextOptions = {},
  ): Promise<T> {
    const nextOptions = { ...options };
    if (nextOptions.prompt) {
      nextOptions.prompt = await this.redactor.redactText(
        nextOptions.prompt,
        redactOptions,
      );
    }
    if (nextOptions.messages) {
      nextOptions.messages = await Promise.all(
        nextOptions.messages.map(async (message) => ({
          ...message,
          content: message.content
            ? await this.redactor.redactText(message.content, redactOptions)
            : message.content,
        })),
      );
    }
    return nextOptions;
  }

  wrapEndpoint<T extends { chat: (options: ChatOptionsLike) => Promise<any> }>(
    endpoint: T,
    redactOptions: RedactTextOptions = {},
  ): T {
    return {
      ...endpoint,
      chat: async (options: ChatOptionsLike) => {
        const redactedOptions = await this.redactChatOptions(
          options,
          redactOptions,
        );
        return endpoint.chat(redactedOptions);
      },
    };
  }
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function hmac(key: string | Buffer, value: string): Buffer {
  return createHmac("sha256", key).update(value, "utf8").digest();
}

function toObserver<T>(
  observerOrNext: ObserverLike<T> | ((value: T) => void),
): ObserverLike<T> {
  if (typeof observerOrNext === "function") {
    return { next: observerOrNext };
  }
  return observerOrNext;
}

function getSignatureKey(
  secretAccessKey: string,
  dateStamp: string,
  region: string,
  service: string,
) {
  const dateKey = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, service);
  return createHmac("sha256", hmac(serviceKey, "aws4_request"));
}

function toAmzDate(date: Date): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}
