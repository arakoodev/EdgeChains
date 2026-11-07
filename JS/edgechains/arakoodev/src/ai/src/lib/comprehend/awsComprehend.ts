import axios from "axios";
import * as crypto from "crypto";
import {
  AwsComprehendOptions,
  ChatEndpointLike,
  ComprehendClientLike,
  PiiEntity,
  PiiEntityType,
  PiiLabel,
  RedactionMode,
  RedactionResult,
} from "./types.js";
import { PromptRedactionObservable } from "./observable.js";

export class AwsComprehendRedactor {
  public region: string;
  public accessKeyId: string;
  public secretAccessKey: string;
  public sessionToken?: string;
  public languageCode: string;
  public minScore: number;
  public entityTypes: (PiiEntityType | string)[];
  public redactionMode: RedactionMode;
  public maskCharacter: string;
  public customReplacer?: (entity: PiiEntity, originalSubstr: string) => string;
  public client?: ComprehendClientLike;
  public fallbackLocalRules: boolean;
  public maxRetry: number;
  public delay: number;

  constructor(options: AwsComprehendOptions = {}) {
    this.region = options.region || process.env.AWS_REGION || "us-east-1";
    this.accessKeyId =
      options.accessKeyId || process.env.AWS_ACCESS_KEY_ID || "";
    this.secretAccessKey =
      options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || "";
    this.sessionToken = options.sessionToken || process.env.AWS_SESSION_TOKEN;
    this.languageCode = options.languageCode || "en";
    this.minScore = options.minScore ?? options.minConfidenceScore ?? 0.5;
    this.entityTypes = options.entityTypes || ["ALL"];
    this.redactionMode =
      options.redactionMode || options.maskMode || "ENTITY_TYPE";
    this.maskCharacter = options.maskCharacter || "*";
    this.customReplacer = options.customReplacer;
    this.client = options.client;
    this.fallbackLocalRules = options.fallbackLocalRules ?? true;
    this.maxRetry = options.maxRetry || 3;
    this.delay = options.delay || 200;
  }

  public async detectPiiEntities(
    text: string,
    languageCode?: string,
  ): Promise<PiiEntity[]> {
    if (!text || text.trim() === "") {
      return [];
    }

    const lang = languageCode || this.languageCode;

    // 1. If an injectable client is provided, use it
    if (this.client) {
      const res = await this.client.detectPiiEntities({
        Text: text,
        LanguageCode: lang,
      });
      return this.filterEntities(res.Entities || []);
    }

    // 2. If AWS credentials are configured, execute SigV4 REST request to AWS Comprehend
    if (this.accessKeyId && this.secretAccessKey) {
      try {
        const host = `comprehend.${this.region}.amazonaws.com`;
        const endpoint = `https://${host}/`;
        const payload = JSON.stringify({
          Text: text,
          LanguageCode: lang,
        });
        const headers = this.signAwsRequest(
          host,
          payload,
          "Comprehend_20171127.DetectPiiEntities",
        );

        const response = await axios.post(endpoint, payload, { headers });
        const rawEntities: PiiEntity[] = response.data?.Entities || [];
        return this.filterEntities(rawEntities);
      } catch (error) {
        if (!this.fallbackLocalRules) {
          throw error;
        }
      }
    }

    // 3. Fallback to local rule-based entity detection if enabled
    if (this.fallbackLocalRules) {
      return this.filterEntities(this.detectLocalFallbackEntities(text));
    }

    return [];
  }

  public async containsPiiEntities(
    text: string,
    languageCode?: string,
  ): Promise<PiiLabel[]> {
    if (!text || text.trim() === "") {
      return [];
    }

    const lang = languageCode || this.languageCode;

    if (this.client?.containsPiiEntities) {
      const res = await this.client.containsPiiEntities({
        Text: text,
        LanguageCode: lang,
      });
      return res.Labels || [];
    }

    if (this.accessKeyId && this.secretAccessKey) {
      const host = `comprehend.${this.region}.amazonaws.com`;
      const endpoint = `https://${host}/`;
      const payload = JSON.stringify({
        Text: text,
        LanguageCode: lang,
      });
      const headers = this.signAwsRequest(
        host,
        payload,
        "Comprehend_20171127.ContainsPiiEntities",
      );

      const response = await axios.post(endpoint, payload, { headers });
      return response.data?.Labels || [];
    }

    return [];
  }

  public async redactText(
    text: string,
    overrideOptions: Partial<AwsComprehendOptions> = {},
  ): Promise<RedactionResult> {
    if (!text || text.length === 0) {
      return {
        originalText: text,
        redactedText: text,
        entities: [],
        redactedCount: 0,
      };
    }

    const minScore =
      overrideOptions.minScore ??
      overrideOptions.minConfidenceScore ??
      this.minScore;
    const allowedTypes = overrideOptions.entityTypes || this.entityTypes;
    const mode =
      overrideOptions.redactionMode ||
      overrideOptions.maskMode ||
      this.redactionMode;
    const maskChar = overrideOptions.maskCharacter || this.maskCharacter;
    const customReplacer =
      overrideOptions.customReplacer || this.customReplacer;
    const lang = overrideOptions.languageCode || this.languageCode;

    const rawEntities = await this.detectPiiEntities(text, lang);
    const filtered = rawEntities.filter((entity) => {
      const scoreOk = entity.Score >= minScore;
      const typeOk =
        allowedTypes.includes("ALL") || allowedTypes.includes(entity.Type);
      return scoreOk && typeOk;
    });

    const resolvedSpans = this.resolveDeterministicSpans(filtered, text.length);

    let redactedText = "";
    let cursor = 0;

    for (const span of resolvedSpans) {
      redactedText += text.slice(cursor, span.BeginOffset);
      const originalSubstr = text.slice(span.BeginOffset, span.EndOffset);

      let replacement: string;
      if (customReplacer) {
        replacement = customReplacer(span, originalSubstr);
      } else if (mode === "MASK" || mode === "ASTERISK") {
        replacement = maskChar.repeat(Math.max(1, originalSubstr.length));
      } else {
        replacement = `[${span.Type}]`;
      }

      redactedText += replacement;
      cursor = span.EndOffset;
    }

    redactedText += text.slice(cursor);

    return {
      originalText: text,
      redactedText,
      entities: resolvedSpans,
      redactedCount: resolvedSpans.length,
    };
  }

  public async redact(
    text: string,
    overrideOptions: Partial<AwsComprehendOptions> = {},
  ): Promise<RedactionResult> {
    return this.redactText(text, overrideOptions);
  }

  public async redactPrompt(
    prompt: string,
    overrideOptions: Partial<AwsComprehendOptions> = {},
  ): Promise<string> {
    const result = await this.redactText(prompt, overrideOptions);
    return result.redactedText;
  }

  public async redactMessages<M extends { role: string; content: string }>(
    messages: M[],
    overrideOptions: Partial<AwsComprehendOptions> = {},
  ): Promise<M[]> {
    const redacted: M[] = [];
    for (const msg of messages) {
      const redactedContent = await this.redactPrompt(
        msg.content,
        overrideOptions,
      );
      redacted.push({
        ...msg,
        content: redactedContent,
      });
    }
    return redacted;
  }

  public observe(
    prompt: string,
    overrideOptions: Partial<AwsComprehendOptions> = {},
  ): PromptRedactionObservable<string> {
    return new PromptRedactionObservable<string>(() =>
      this.redactPrompt(prompt, overrideOptions),
    );
  }

  public observeDetailed(
    prompt: string,
    overrideOptions: Partial<AwsComprehendOptions> = {},
  ): PromptRedactionObservable<RedactionResult> {
    return new PromptRedactionObservable<RedactionResult>(() =>
      this.redactText(prompt, overrideOptions),
    );
  }

  public observeMessages<M extends { role: string; content: string }>(
    messages: M[],
    overrideOptions: Partial<AwsComprehendOptions> = {},
  ): PromptRedactionObservable<M[]> {
    return new PromptRedactionObservable<M[]>(() =>
      this.redactMessages(messages, overrideOptions),
    );
  }

  public chainWithEndpoint(
    endpoint: ChatEndpointLike,
    chatOptions: { prompt: string; [key: string]: any },
    overrideOptions: Partial<AwsComprehendOptions> = {},
  ): PromptRedactionObservable<{ redaction: RedactionResult; response: any }> {
    return new PromptRedactionObservable<{
      redaction: RedactionResult;
      response: any;
    }>(async () => {
      const redaction = await this.redactText(
        chatOptions.prompt,
        overrideOptions,
      );
      const response = await endpoint.chat({
        ...chatOptions,
        prompt: redaction.redactedText,
      });
      return { redaction, response };
    });
  }

  private filterEntities(entities: PiiEntity[]): PiiEntity[] {
    return entities.filter((e) => {
      if (e.Score < this.minScore) return false;
      if (this.entityTypes.includes("ALL")) return true;
      return this.entityTypes.includes(e.Type);
    });
  }

  private resolveDeterministicSpans(
    entities: PiiEntity[],
    textLength: number,
  ): PiiEntity[] {
    const valid = entities.filter(
      (e) =>
        e.BeginOffset >= 0 &&
        e.EndOffset <= textLength &&
        e.BeginOffset < e.EndOffset,
    );

    // Sort primarily by BeginOffset ascending; on tie, longer span first, then higher score
    valid.sort((a, b) => {
      if (a.BeginOffset !== b.BeginOffset) {
        return a.BeginOffset - b.BeginOffset;
      }
      const lenA = a.EndOffset - a.BeginOffset;
      const lenB = b.EndOffset - b.BeginOffset;
      if (lenA !== lenB) {
        return lenB - lenA;
      }
      return b.Score - a.Score;
    });

    // Eliminate overlapping spans deterministically
    const nonOverlapping: PiiEntity[] = [];
    let lastEnd = -1;

    for (const item of valid) {
      if (item.BeginOffset >= lastEnd) {
        nonOverlapping.push(item);
        lastEnd = item.EndOffset;
      }
    }

    return nonOverlapping;
  }

  private detectLocalFallbackEntities(text: string): PiiEntity[] {
    const patterns: Array<{ type: PiiEntityType; regex: RegExp }> = [
      {
        type: "EMAIL",
        regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      },
      { type: "SSN", regex: /\b\d{3}-\d{2}-\d{4}\b/g },
      {
        type: "PHONE",
        regex: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
      },
      { type: "CREDIT_DEBIT_NUMBER", regex: /\b(?:\d[ -]*?){13,16}\b/g },
      { type: "AWS_ACCESS_KEY", regex: /\bAKIA[0-9A-Z]{16}\b/g },
      { type: "IP_ADDRESS", regex: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g },
    ];

    const found: PiiEntity[] = [];
    for (const { type, regex } of patterns) {
      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null) {
        found.push({
          Type: type,
          Score: 0.99,
          BeginOffset: match.index,
          EndOffset: match.index + match[0].length,
        });
      }
    }

    return found;
  }

  private signAwsRequest(
    host: string,
    payload: string,
    amzTarget: string,
  ): Record<string, string> {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    const service = "comprehend";
    const contentType = "application/x-amz-json-1.1";
    const payloadHash = crypto
      .createHash("sha256")
      .update(payload, "utf8")
      .digest("hex");

    let canonicalHeaders =
      `content-type:${contentType}\n` +
      `host:${host}\n` +
      `x-amz-date:${amzDate}\n` +
      `x-amz-target:${amzTarget}\n`;
    let signedHeaders = "content-type;host;x-amz-date;x-amz-target";

    if (this.sessionToken) {
      canonicalHeaders += `x-amz-security-token:${this.sessionToken}\n`;
      signedHeaders += ";x-amz-security-token";
    }

    const canonicalRequest = [
      "POST",
      "/",
      "",
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join("\n");

    const algorithm = "AWS4-HMAC-SHA256";
    const credentialScope = `${dateStamp}/${this.region}/${service}/aws4_request`;
    const stringToSign = [
      algorithm,
      amzDate,
      credentialScope,
      crypto
        .createHash("sha256")
        .update(canonicalRequest, "utf8")
        .digest("hex"),
    ].join("\n");

    const kDate = crypto
      .createHmac("sha256", "AWS4" + this.secretAccessKey)
      .update(dateStamp)
      .digest();
    const kRegion = crypto
      .createHmac("sha256", kDate)
      .update(this.region)
      .digest();
    const kService = crypto
      .createHmac("sha256", kRegion)
      .update(service)
      .digest();
    const kSigning = crypto
      .createHmac("sha256", kService)
      .update("aws4_request")
      .digest();
    const signature = crypto
      .createHmac("sha256", kSigning)
      .update(stringToSign, "utf8")
      .digest("hex");

    const authorizationHeader =
      `${algorithm} Credential=${this.accessKeyId}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "X-Amz-Date": amzDate,
      "X-Amz-Target": amzTarget,
      Authorization: authorizationHeader,
    };
    if (this.sessionToken) {
      headers["X-Amz-Security-Token"] = this.sessionToken;
    }

    return headers;
  }
}

export { AwsComprehendRedactor as AwsComprehendRedact };
export { AwsComprehendRedactor as ComprehendEndpoint };
