import axios from "axios";
import { createHash, createHmac } from "node:crypto";

type HeaderMap = Record<string, string>;

interface HttpClient {
  post(
    url: string,
    data?: string,
    config?: { headers: HeaderMap },
  ): Promise<{ data: AWSComprehendPiiDetectionResponse }>;
}

export type AWSComprehendPiiEntityType =
  | "ADDRESS"
  | "AGE"
  | "AWS_ACCESS_KEY"
  | "AWS_SECRET_KEY"
  | "BANK_ACCOUNT_NUMBER"
  | "BANK_ROUTING"
  | "CREDIT_DEBIT_CVV"
  | "CREDIT_DEBIT_EXPIRY"
  | "CREDIT_DEBIT_NUMBER"
  | "DATE_TIME"
  | "DRIVER_ID"
  | "EMAIL"
  | "IP_ADDRESS"
  | "MAC_ADDRESS"
  | "NAME"
  | "PASSWORD"
  | "PHONE"
  | "PIN"
  | "SSN"
  | "URL"
  | "USERNAME"
  | string;

export interface AWSComprehendPiiEntity {
  Type: AWSComprehendPiiEntityType;
  Score: number;
  BeginOffset: number;
  EndOffset: number;
}

export interface AWSComprehendPiiDetectionRequest {
  Text: string;
  LanguageCode?: string;
}

export interface AWSComprehendPiiDetectionResponse {
  Entities?: AWSComprehendPiiEntity[];
}

export interface AWSComprehendPiiClient {
  detectPiiEntities(
    input: AWSComprehendPiiDetectionRequest,
  ): Promise<AWSComprehendPiiDetectionResponse>;
}

export interface AWSCredentials {
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
}

export interface AWSComprehendRestClientOptions extends AWSCredentials {
  region?: string;
  httpClient?: HttpClient;
  now?: () => Date;
}

export interface AWSComprehendRedactedEntity extends AWSComprehendPiiEntity {
  Text: string;
  Replacement: string;
}

export interface AWSComprehendRedactionResult {
  originalText: string;
  redactedText: string;
  entities: AWSComprehendRedactedEntity[];
}

export type AWSComprehendReplacement =
  | string
  | ((entity: AWSComprehendRedactedEntity) => string);

export interface AWSComprehendRedactionOptions {
  languageCode?: string;
  minScore?: number;
  redactTypes?: AWSComprehendPiiEntityType[];
  replacement?: AWSComprehendReplacement;
}

export interface AWSComprehendRedactorOptions
  extends AWSComprehendRestClientOptions, AWSComprehendRedactionOptions {
  client?: AWSComprehendPiiClient;
}

export interface AWSComprehendMessage {
  content?: string;
  [key: string]: unknown;
}

export interface AWSComprehendChatOptions {
  prompt?: string;
  messages?: AWSComprehendMessage[];
  [key: string]: unknown;
}

export interface AWSComprehendChatEndpoint {
  chat(options: AWSComprehendChatOptions): Promise<unknown>;
}

interface NormalizedRedactionOptions {
  languageCode: string;
  minScore: number;
  redactTypes?: AWSComprehendPiiEntityType[];
  replacement?: AWSComprehendReplacement;
}

interface RedactionSpan {
  begin: number;
  end: number;
  entity: AWSComprehendRedactedEntity;
}

export class AWSComprehendRestClient implements AWSComprehendPiiClient {
  private readonly region: string;
  private readonly endpoint: string;
  private readonly httpClient: HttpClient;
  private readonly now: () => Date;
  private readonly accessKeyId?: string;
  private readonly secretAccessKey?: string;
  private readonly sessionToken?: string;

  constructor(options: AWSComprehendRestClientOptions = {}) {
    this.region =
      options.region ||
      process.env.AWS_REGION ||
      process.env.AWS_DEFAULT_REGION ||
      "us-east-1";
    this.endpoint = `https://comprehend.${this.region}.amazonaws.com/`;
    this.httpClient = options.httpClient || (axios as HttpClient);
    this.now = options.now || (() => new Date());
    this.accessKeyId = options.accessKeyId || process.env.AWS_ACCESS_KEY_ID;
    this.secretAccessKey =
      options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY;
    this.sessionToken = options.sessionToken || process.env.AWS_SESSION_TOKEN;
  }

  async detectPiiEntities(
    input: AWSComprehendPiiDetectionRequest,
  ): Promise<AWSComprehendPiiDetectionResponse> {
    if (!input.Text) {
      return { Entities: [] };
    }

    const credentials = this.resolveCredentials();
    const payload = JSON.stringify({
      Text: input.Text,
      LanguageCode: input.LanguageCode || "en",
    });
    const headers = this.createSignedHeaders(payload, credentials);
    const response = await this.httpClient.post(this.endpoint, payload, {
      headers,
    });
    return response.data;
  }

  private resolveCredentials(): Required<
    Pick<AWSCredentials, "accessKeyId" | "secretAccessKey">
  > &
    Pick<AWSCredentials, "sessionToken"> {
    if (!this.accessKeyId || !this.secretAccessKey) {
      throw new Error(
        "AWS credentials are required to call Comprehend. Provide accessKeyId/secretAccessKey or set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.",
      );
    }

    return {
      accessKeyId: this.accessKeyId,
      secretAccessKey: this.secretAccessKey,
      sessionToken: this.sessionToken,
    };
  }

  private createSignedHeaders(
    payload: string,
    credentials: Required<
      Pick<AWSCredentials, "accessKeyId" | "secretAccessKey">
    > &
      Pick<AWSCredentials, "sessionToken">,
  ): HeaderMap {
    const date = this.now();
    const amzDate = toAmzDate(date);
    const dateStamp = amzDate.slice(0, 8);
    const host = `comprehend.${this.region}.amazonaws.com`;
    const service = "comprehend";

    const headers: HeaderMap = {
      "content-type": "application/x-amz-json-1.1",
      host,
      "x-amz-date": amzDate,
      "x-amz-target": "Comprehend_20171127.DetectPiiEntities",
    };

    if (credentials.sessionToken) {
      headers["x-amz-security-token"] = credentials.sessionToken;
    }

    const sortedHeaderNames = Object.keys(headers).sort();
    const canonicalHeaders = sortedHeaderNames
      .map((name) => `${name}:${headers[name].trim()}\n`)
      .join("");
    const signedHeaders = sortedHeaderNames.join(";");
    const canonicalRequest = [
      "POST",
      "/",
      "",
      canonicalHeaders,
      signedHeaders,
      sha256Hex(payload),
    ].join("\n");
    const credentialScope = `${dateStamp}/${this.region}/${service}/aws4_request`;
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      credentialScope,
      sha256Hex(canonicalRequest),
    ].join("\n");
    const signingKey = getSignatureKey(
      credentials.secretAccessKey,
      dateStamp,
      this.region,
      service,
    );
    const signature = createHmac("sha256", signingKey)
      .update(stringToSign, "utf8")
      .digest("hex");

    return {
      ...headers,
      Authorization: `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    };
  }
}

export class AWSComprehendRedactor {
  private readonly client: AWSComprehendPiiClient;
  private readonly defaults: NormalizedRedactionOptions;

  constructor(options: AWSComprehendRedactorOptions = {}) {
    const {
      client,
      languageCode,
      minScore,
      redactTypes,
      replacement,
      ...restClientOptions
    } = options;

    this.client = client || new AWSComprehendRestClient(restClientOptions);
    this.defaults = {
      languageCode: languageCode || "en",
      minScore: minScore ?? 0.5,
      redactTypes,
      replacement,
    };
  }

  async detectPii(
    text: string,
    options: AWSComprehendRedactionOptions = {},
  ): Promise<AWSComprehendPiiEntity[]> {
    if (!text) {
      return [];
    }

    const mergedOptions = this.mergeOptions(options);
    const response = await this.client.detectPiiEntities({
      Text: text,
      LanguageCode: mergedOptions.languageCode,
    });
    return response.Entities || [];
  }

  async redact(
    text: string,
    options: AWSComprehendRedactionOptions = {},
  ): Promise<string> {
    const result = await this.redactText(text, options);
    return result.redactedText;
  }

  async redactText(
    text: string,
    options: AWSComprehendRedactionOptions = {},
  ): Promise<AWSComprehendRedactionResult> {
    if (!text) {
      return { originalText: text, redactedText: text, entities: [] };
    }

    const mergedOptions = this.mergeOptions(options);
    const detectedEntities = await this.detectPii(text, mergedOptions);
    const spans = this.createRedactionSpans(
      text,
      detectedEntities,
      mergedOptions,
    );
    let redactedText = text;

    for (const span of spans.slice().reverse()) {
      redactedText =
        redactedText.slice(0, span.begin) +
        span.entity.Replacement +
        redactedText.slice(span.end);
    }

    return {
      originalText: text,
      redactedText,
      entities: spans.map((span) => span.entity),
    };
  }

  async redactPrompt(
    prompt: string,
    options: AWSComprehendRedactionOptions = {},
  ): Promise<string> {
    return this.redact(prompt, options);
  }

  async redactMessages<TMessage extends AWSComprehendMessage>(
    messages: TMessage[],
    options: AWSComprehendRedactionOptions = {},
  ): Promise<TMessage[]> {
    const redactedMessages: TMessage[] = [];

    for (const message of messages) {
      if (typeof message.content === "string") {
        redactedMessages.push({
          ...message,
          content: await this.redact(message.content, options),
        });
      } else {
        redactedMessages.push({ ...message });
      }
    }

    return redactedMessages;
  }

  async redactChatOptions<TOptions extends AWSComprehendChatOptions>(
    chatOptions: TOptions,
    options: AWSComprehendRedactionOptions = {},
  ): Promise<TOptions> {
    const nextOptions: AWSComprehendChatOptions = { ...chatOptions };

    if (typeof chatOptions.prompt === "string") {
      nextOptions.prompt = await this.redact(chatOptions.prompt, options);
    }

    if (Array.isArray(chatOptions.messages)) {
      nextOptions.messages = await this.redactMessages(
        chatOptions.messages,
        options,
      );
    }

    return nextOptions as TOptions;
  }

  async chain<TResult>(
    prompt: string,
    next: (
      redactedPrompt: string,
      result: AWSComprehendRedactionResult,
    ) => TResult | Promise<TResult>,
    options: AWSComprehendRedactionOptions = {},
  ): Promise<TResult> {
    const result = await this.redactText(prompt, options);
    return next(result.redactedText, result);
  }

  chainEndpoint<TEndpoint extends AWSComprehendChatEndpoint>(
    endpoint: TEndpoint,
    options: AWSComprehendRedactionOptions = {},
  ): TEndpoint {
    const redactor = this;

    return new Proxy(endpoint, {
      get(target, property, receiver) {
        if (property === "chat") {
          return async (chatOptions: AWSComprehendChatOptions) => {
            const redactedOptions = await redactor.redactChatOptions(
              chatOptions,
              options,
            );
            return target.chat(redactedOptions);
          };
        }

        return Reflect.get(target, property, receiver);
      },
    }) as TEndpoint;
  }

  wrapEndpoint<TEndpoint extends AWSComprehendChatEndpoint>(
    endpoint: TEndpoint,
    options: AWSComprehendRedactionOptions = {},
  ): TEndpoint {
    return this.chainEndpoint(endpoint, options);
  }

  async *redactStream(
    source: AsyncIterable<string> | Iterable<string>,
    options: AWSComprehendRedactionOptions = {},
  ): AsyncGenerator<string> {
    for await (const chunk of source) {
      yield await this.redact(chunk, options);
    }
  }

  textOperator(
    options: AWSComprehendRedactionOptions = {},
  ): (value: string) => Promise<string> {
    return (value: string) => this.redact(value, options);
  }

  chatOptionsOperator<TOptions extends AWSComprehendChatOptions>(
    options: AWSComprehendRedactionOptions = {},
  ): (value: TOptions) => Promise<TOptions> {
    return (value: TOptions) => this.redactChatOptions(value, options);
  }

  streamOperator(
    options: AWSComprehendRedactionOptions = {},
  ): (
    source: AsyncIterable<string> | Iterable<string>,
  ) => AsyncGenerator<string> {
    return (source: AsyncIterable<string> | Iterable<string>) =>
      this.redactStream(source, options);
  }

  private mergeOptions(
    options: AWSComprehendRedactionOptions,
  ): NormalizedRedactionOptions {
    return {
      languageCode: options.languageCode || this.defaults.languageCode,
      minScore: options.minScore ?? this.defaults.minScore,
      redactTypes: options.redactTypes || this.defaults.redactTypes,
      replacement: options.replacement ?? this.defaults.replacement,
    };
  }

  private createRedactionSpans(
    text: string,
    entities: AWSComprehendPiiEntity[],
    options: NormalizedRedactionOptions,
  ): RedactionSpan[] {
    const spans = entities
      .filter((entity) => this.shouldRedact(entity, options))
      .map((entity) => this.toRedactionSpan(text, entity, options))
      .filter((span): span is RedactionSpan => Boolean(span))
      .sort(
        (left, right) =>
          left.begin - right.begin ||
          right.end - left.end ||
          right.entity.Score - left.entity.Score,
      );
    const acceptedSpans: RedactionSpan[] = [];
    let lastEnd = -1;

    for (const span of spans) {
      if (span.begin < lastEnd) {
        continue;
      }

      acceptedSpans.push(span);
      lastEnd = span.end;
    }

    return acceptedSpans;
  }

  private toRedactionSpan(
    text: string,
    entity: AWSComprehendPiiEntity,
    options: NormalizedRedactionOptions,
  ): RedactionSpan | undefined {
    const begin = codePointOffsetToCodeUnitIndex(text, entity.BeginOffset);
    const end = codePointOffsetToCodeUnitIndex(text, entity.EndOffset);

    if (begin < 0 || end > text.length || begin >= end) {
      return undefined;
    }

    const redactedEntity: AWSComprehendRedactedEntity = {
      ...entity,
      Text: text.slice(begin, end),
      Replacement: "",
    };
    redactedEntity.Replacement = this.replacementFor(redactedEntity, options);

    return {
      begin,
      end,
      entity: redactedEntity,
    };
  }

  private shouldRedact(
    entity: AWSComprehendPiiEntity,
    options: NormalizedRedactionOptions,
  ): boolean {
    if ((entity.Score ?? 0) < options.minScore) {
      return false;
    }

    if (!options.redactTypes?.length) {
      return true;
    }

    const allowedTypes = new Set(
      options.redactTypes.map((type) => type.toUpperCase()),
    );
    return (
      allowedTypes.has("ALL") || allowedTypes.has(entity.Type.toUpperCase())
    );
  }

  private replacementFor(
    entity: AWSComprehendRedactedEntity,
    options: NormalizedRedactionOptions,
  ): string {
    if (typeof options.replacement === "function") {
      return options.replacement(entity);
    }

    if (typeof options.replacement === "string") {
      return options.replacement.replace("{type}", entity.Type);
    }

    return `[REDACTED_${entity.Type}]`;
  }
}

export class AWSComprehendPIIRedactor extends AWSComprehendRedactor {}

function codePointOffsetToCodeUnitIndex(input: string, offset: number): number {
  if (offset <= 0) {
    return 0;
  }

  let codePointIndex = 0;

  for (let codeUnitIndex = 0; codeUnitIndex < input.length; ) {
    if (codePointIndex === offset) {
      return codeUnitIndex;
    }

    const codePoint = input.codePointAt(codeUnitIndex);
    codeUnitIndex += codePoint && codePoint > 0xffff ? 2 : 1;
    codePointIndex += 1;
  }

  return input.length;
}

function toAmzDate(date: Date): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function hmac(key: string | Buffer, value: string): Buffer {
  return createHmac("sha256", key).update(value, "utf8").digest();
}

function getSignatureKey(
  secretAccessKey: string,
  dateStamp: string,
  region: string,
  service: string,
) {
  const dateKey = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const dateRegionKey = hmac(dateKey, region);
  const dateRegionServiceKey = hmac(dateRegionKey, service);
  return hmac(dateRegionServiceKey, "aws4_request");
}
