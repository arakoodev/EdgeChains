import { Observable, from, of } from 'rxjs';
import { switchMap, map, catchError } from 'rxjs/operators';
import { ComprehendClient, DetectPiiEntitiesCommand, PiiEntityType } from '@aws-sdk/client-comprehend';

/**
 * Configuration for the AWS Comprehend client.
 */
export interface ComprehendConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  languageCode?: string; // Default to 'en'
}

/**
 * Options for the ComprehendRedaction utility.
 */
export interface ComprehendRedactionOptions {
  /**
   * The language code of the input text. Defaults to 'en'.
   * See https://docs.aws.amazon.com/comprehend/latest/dg/supported-languages.html
   */
  languageCode?: string;
  /**
   * An optional list of PII entity types to detect and redact.
   * If not provided, all supported PII entity types will be detected.
   * See https://docs.aws.amazon.com/comprehend/latest/dg/how-pii.html#how-pii-entity-types
   */
  entityTypes?: PiiEntityType[];
}

/**
 * A utility class to redact Personally Identifiable Information (PII) from text
 * using AWS Comprehend. This class can be chained with existing Endpoint classes
 * as an observable operator.
 */
export class ComprehendRedaction {
  private comprehendClient: ComprehendClient;
  private options: ComprehendRedactionOptions;

  constructor(config: ComprehendConfig, options?: ComprehendRedactionOptions) {
    if (!config.region || !config.accessKeyId || !config.secretAccessKey) {
      throw new Error('AWS Comprehend configuration requires region, accessKeyId, and secretAccessKey.');
    }

    this.comprehendClient = new ComprehendClient({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });

    this.options = {
      languageCode: options?.languageCode || 'en',
      entityTypes: options?.entityTypes,
    };
  }

  /**
   * Executes the PII detection and redaction process on an observable stream of strings.
   * Each string in the stream will be processed by AWS Comprehend, and PII entities
   * will be replaced with a redacted placeholder (e.g., "[REDACTED_NAME]").
   *
   * @param input$ An Observable stream of strings to be redacted.
   * @returns An Observable stream of redacted strings.
   */
  execute(input$: Observable<string>): Observable<string> {
    return input$.pipe(
      switchMap((text) => from(this.redactText(text))),
      catchError((error) => {
        console.error('Error during Comprehend PII redaction:', error);
        // Depending on desired behavior, you might rethrow, return original text, or a default.
        // For now, we'll return the original text on error to avoid breaking the chain.
        return of(error.originalText || 'Error during redaction.');
      })
    );
  }

  /**
   * Detects PII entities in a given text and replaces them with a redacted placeholder.
   * @param text The input text to redact.
   * @returns A Promise that resolves to the redacted text.
   */
  private async redactText(text: string): Promise<string> {
    if (!text || text.trim() === '') {
      return text;
    }

    try {
      const command = new DetectPiiEntitiesCommand({
        Text: text,
        LanguageCode: this.options.languageCode,
      });

      const response = await this.comprehendClient.send(command);
      let redactedText = text;

      // Sort entities by offset in descending order to avoid issues with index shifts
      // when replacing substrings.
      const sortedEntities = (response.Entities || []).sort((a, b) => (b.BeginOffset || 0) - (a.BeginOffset || 0));

      for (const entity of sortedEntities) {
        if (entity.BeginOffset !== undefined && entity.EndOffset !== undefined && entity.Type) {
          // If specific entity types are provided, only redact those.
          if (this.options.entityTypes && !this.options.entityTypes.includes(entity.Type)) {
            continue;
          }

          const piiEntity = text.substring(entity.BeginOffset, entity.EndOffset);
          const placeholder = `[REDACTED_${entity.Type}]`;
          redactedText =
            redactedText.substring(0, entity.BeginOffset) +
            placeholder +
            redactedText.substring(entity.EndOffset);
        }
      }
      return redactedText;
    } catch (error) {
      console.error('AWS Comprehend API call failed:', error);
      // Attach original text to error for potential recovery in catchError operator
      (error as any).originalText = text;
      throw error;
    }
  }
}
