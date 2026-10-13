import { Observable } from "rxjs";

export type PiiEntityType =
  | "ADDRESS" | "AGE" | "AWS_ACCESS_KEY" | "AWS_SECRET_KEY" | "BANK_ACCOUNT_NUMBER"
  | "BANK_ROUTING" | "CREDIT_DEBIT_CVV" | "CREDIT_DEBIT_EXPIRY" | "CREDIT_DEBIT_NUMBER"
  | "DATE_TIME" | "DRIVER_ID" | "EMAIL" | "INTERNATIONAL_BANK_ACCOUNT_NUMBER"
  | "IP_ADDRESS" | "LICENSE_PLATE" | "MAC_ADDRESS" | "NAME" | "PASSPORT_NUMBER"
  | "PASSWORD" | "PHONE" | "PIN" | "SSN" | "URL" | "USERNAME" | "VEHICLE_IDENTIFICATION_NUMBER";

export interface ComprehendRedactorConfig {
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

export interface RedactResult {
  original: string;
  redacted: string;
  piiEntities: Array<{ type: string; score: number }>;
}

function maskPii(text: string, piiEntities: Array<{ type: string; score: number; beginOffset: number; endOffset: number }>): string {
  let result = text;
  const sorted = [...piiEntities].sort((a, b) => b.beginOffset - a.beginOffset);
  for (const entity of sorted) {
    const mask = `[${entity.type}]`;
    result = result.slice(0, entity.beginOffset) + mask + result.slice(entity.endOffset);
  }
  return result;
}

export class ComprehendRedactor {
  private config: ComprehendRedactorConfig;

  constructor(config: ComprehendRedactorConfig = {}) {
    this.config = {
      region: config.region || process.env.AWS_REGION || "us-east-1",
      accessKeyId: config.accessKeyId || process.env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: config.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || "",
    };
  }

  async redact(text: string, piiTypes?: PiiEntityType[]): Promise<RedactResult> {
    const entities = await this.detectPii(text, piiTypes);
    const redacted = maskPii(text, entities);
    return {
      original: text,
      redacted,
      piiEntities: entities.map(e => ({ type: e.type, score: e.score })),
    };
  }

  redact$(text: string, piiTypes?: PiiEntityType[]): Observable<RedactResult> {
    return new Observable(subscriber => {
      this.redact(text, piiTypes)
        .then(result => {
          subscriber.next(result);
          subscriber.complete();
        })
        .catch(err => subscriber.error(err));
    });
  }

  mask$(source: Observable<string>, piiTypes?: PiiEntityType[]): Observable<string> {
    return new Observable(subscriber => {
      source.subscribe({
        next: async (text) => {
          try {
            const result = await this.redact(text, piiTypes);
            subscriber.next(result.redacted);
          } catch (err) {
            subscriber.error(err);
          }
        },
        error: (err) => subscriber.error(err),
        complete: () => subscriber.complete(),
      });
    });
  }

  private async detectPii(
    text: string,
    piiTypes?: PiiEntityType[],
  ): Promise<Array<{ type: string; score: number; beginOffset: number; endOffset: number }>> {
    const { ComprehendClient, DetectPiiEntitiesCommand } = await import("@aws-sdk/client-comprehend");

    const client = new ComprehendClient({
      region: this.config.region,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      },
    });

    const command = new DetectPiiEntitiesCommand({
      Text: text,
      LanguageCode: "en",
    });

    const response = await client.send(command);
    const entities = (response.Entities || [])
      .filter(e => !piiTypes || piiTypes.includes(e.Type as PiiEntityType))
      .map(e => ({
        type: e.Type || "UNKNOWN",
        score: e.Score || 0,
        beginOffset: e.BeginOffset || 0,
        endOffset: e.EndOffset || 0,
      }));

    return entities;
  }
}
