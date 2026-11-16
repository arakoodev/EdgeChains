import {
  ComprehendClient,
  ComprehendClientConfig,
  DetectPiiEntitiesCommand,
  LanguageCode,
  PiiEntity,
} from "@aws-sdk/client-comprehend";
import { Observable, from, switchMap } from "rxjs";

export interface RedactorOptions {
  clientConfig?: ComprehendClientConfig;
  languageCode?: LanguageCode;
  threshold?: number;
}

export class AWSComprehendRedactor {
  private client: ComprehendClient;
  private languageCode: LanguageCode;
  private threshold: number;

  constructor(options: RedactorOptions = {}) {
    this.client = new ComprehendClient(options.clientConfig || { region: "us-east-1" });
    this.languageCode = options.languageCode || "en";
    this.threshold = options.threshold ?? 0.8;
  }

  async redact(text: string): Promise<string> {
    if (!text || text.trim().length === 0) return text;

    const command = new DetectPiiEntitiesCommand({
      Text: text,
      LanguageCode: this.languageCode,
    });

        const response = await this.client.send(command);
    const entities = response.Entities || [];

    const validEntities = entities
      .filter((e): e is PiiEntity & { BeginOffset: number; EndOffset: number } =>
        e.Score !== undefined &&
        e.Score >= this.threshold &&
        e.BeginOffset !== undefined &&
        e.EndOffset !== undefined
      )
      .sort((a, b) => b.BeginOffset - a.BeginOffset);

    let redactedText = text;
    for (const entity of validEntities) {
      const mask = `[REDACTED_${entity.Type || "PII"}]`;
      redactedText =
        redactedText.substring(0, entity.BeginOffset) +
        mask +
        redactedText.substring(entity.EndOffset);
    }

    return redactedText;
  }

  redactOperator() {
    return (source$: Observable<string>): Observable<string> => {
      return source$.pipe(
        switchMap((text) => from(this.redact(text)))
      );
    };
  }
}