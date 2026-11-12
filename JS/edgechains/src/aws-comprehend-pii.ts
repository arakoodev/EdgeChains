/**
 * AWS Comprehend PII Redaction Utility with Observable Endpoint Chaining
 * Bounty: arakoodev/EdgeChains #290 ($75 USD)
 *
 * Uses AWS Signature Version 4 (zero external AWS SDK bloat) to invoke
 * Comprehend_20171127.DetectPiiEntities and redact sensitive PII spans before
 * chaining prompts into downstream LLM Endpoints.
 */
import { createHmac, createHash } from 'node:crypto';

export interface PiiEntity {
  Score: number;
  Type: string;
  BeginOffset: number;
  EndOffset: number;
}

export interface AwsComprehendConfig {
  region?: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  languageCode?: string;
  minScore?: number;
  maskMode?: 'TYPE_TAG' | 'ASTERISK';
  fetchImpl?: typeof fetch;
}

export class AwsComprehendPiiRedactor {
  private readonly region: string;
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly sessionToken?: string;
  private readonly languageCode: string;
  private readonly minScore: number;
  private readonly maskMode: 'TYPE_TAG' | 'ASTERISK';
  private readonly fetchImpl: typeof fetch;
  private readonly listeners: Array<(event: { original: string; redacted: string; entities: PiiEntity[] }) => void> = [];

  constructor(config: AwsComprehendConfig) {
    this.region = config.region || 'us-east-1';
    this.accessKeyId = config.accessKeyId;
    this.secretAccessKey = config.secretAccessKey;
    this.sessionToken = config.sessionToken;
    this.languageCode = config.languageCode || 'en';
    this.minScore = config.minScore ?? 0.5;
    this.maskMode = config.maskMode || 'TYPE_TAG';
    this.fetchImpl = config.fetchImpl || globalThis.fetch;
  }

  onRedaction(listener: (event: { original: string; redacted: string; entities: PiiEntity[] }) => void) {
    this.listeners.push(listener);
    return this;
  }

  private signAwsV4(payload: string, amzDate: string) {
    const dateStamp = amzDate.slice(0, 8);
    const service = 'comprehend';
    const host = `comprehend.${this.region}.amazonaws.com`;
    const target = 'Comprehend_20171127.DetectPiiEntities';
    const contentType = 'application/x-amz-json-1.1';
    const payloadHash = createHash('sha256').update(payload, 'utf8').digest('hex');

    const canonicalHeaders =
      `content-type:${contentType}\n` +
      `host:${host}\n` +
      `x-amz-date:${amzDate}\n` +
      `x-amz-target:${target}\n`;
    const signedHeaders = 'content-type;host;x-amz-date;x-amz-target';
    const canonicalRequest = [
      'POST',
      '/',
      '',
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const credentialScope = `${dateStamp}/${this.region}/${service}/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      createHash('sha256').update(canonicalRequest, 'utf8').digest('hex'),
    ].join('\n');

    const hmac = (key: Buffer | string, data: string) => createHmac('sha256', key).update(data, 'utf8').digest();
    const kDate = hmac(`AWS4${this.secretAccessKey}`, dateStamp);
    const kRegion = hmac(kDate, this.region);
    const kService = hmac(kRegion, service);
    const kSigning = hmac(kService, 'aws4_request');
    const signature = createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

    return {
      endpoint: `https://${host}/`,
      headers: {
        'Content-Type': contentType,
        'X-Amz-Date': amzDate,
        'X-Amz-Target': target,
        ...(this.sessionToken ? { 'X-Amz-Security-Token': this.sessionToken } : {}),
        Authorization: `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      },
    };
  }

  async detectPiiEntities(text: string): Promise<PiiEntity[]> {
    const body = JSON.stringify({
      Text: text,
      LanguageCode: this.languageCode,
    });
    const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    const signed = this.signAwsV4(body, amzDate);

    const res = await this.fetchImpl(signed.endpoint, {
      method: 'POST',
      headers: signed.headers,
      body,
    });

    const data = (await res.json().catch(() => ({}))) as { Entities?: PiiEntity[]; message?: string };
    if (!res.ok) {
      throw new Error(data.message || `AWS Comprehend Error (${res.status})`);
    }
    return (data.Entities || []).filter((e) => e.Score >= this.minScore);
  }

  static applyRedactionSpans(text: string, entities: PiiEntity[], maskMode: 'TYPE_TAG' | 'ASTERISK' = 'TYPE_TAG'): string {
    const sorted = [...entities].sort((a, b) => b.BeginOffset - a.BeginOffset);
    let output = text;
    for (const entity of sorted) {
      const replacement =
        maskMode === 'ASTERISK'
          ? '*'.repeat(Math.max(4, entity.EndOffset - entity.BeginOffset))
          : `[REDACTED_${entity.Type}]`;
      output = output.slice(0, entity.BeginOffset) + replacement + output.slice(entity.EndOffset);
    }
    return output;
  }

  async redact(text: string): Promise<{ original: string; redacted: string; entities: PiiEntity[] }> {
    const entities = await this.detectPiiEntities(text);
    const redacted = AwsComprehendPiiRedactor.applyRedactionSpans(text, entities, this.maskMode);
    const result = { original: text, redacted, entities };
    for (const listener of this.listeners) {
      listener(result);
    }
    return result;
  }

  /**
   * Chain with an EdgeChains Endpoint or async prompt handler so PII is automatically
   * redacted before the prompt is sent to the LLM.
   */
  chainWithEndpoint<TOut>(endpointCall: (redactedPrompt: string) => Promise<TOut>) {
    return async (rawPrompt: string): Promise<{ redactedPrompt: string; entities: PiiEntity[]; response: TOut }> => {
      const { redacted, entities } = await this.redact(rawPrompt);
      const response = await endpointCall(redacted);
      return { redactedPrompt: redacted, entities, response };
    };
  }
}
