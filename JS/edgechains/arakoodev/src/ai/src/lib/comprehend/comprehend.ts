import {
  BatchDetectPiiEntitiesCommand,
  ComprehendClient,
  DetectPiiEntitiesCommand,
  PiiEntity,
} from "@aws-sdk/client-comprehend";

export interface AWSComprehendOptions {
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

export class AWSComprehend {
  private client: ComprehendClient;

  constructor(options: AWSComprehendOptions = {}) {
    this.client = new ComprehendClient({
      region: options.region || process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: options.accessKeyId || process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey:
          options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || "",
      },
    });
  }

  /**
   * Detects PII entities in the given text.
   * @param text The text to analyze.
   * @returns A promise that resolves to an array of PII entities.
   */
  async detectPii(text: string): Promise<PiiEntity[]> {
    const command = new DetectPiiEntitiesCommand({
      Text: text,
      LanguageCode: "en", // Default to English as per AWS Comprehend SDK
    });

    try {
      const response = await this.client.send(command);
      return response.Entities || [];
    } catch (error) {
      console.error("Error detecting PII entities:", error);
      throw error;
    }
  }

  /**
   * Detects PII entities in a batch of texts.
   * @param texts An array of strings to analyze (max 25 per AWS call, automatically chunked).
   * @returns A promise that resolves to an array where each element corresponds to the input text
   *          at the same index, containing either an array of PiiEntity or an Error.
   */
  async batchDetectPii(texts: string[]): Promise<(PiiEntity[] | Error)[]> {
    const BATCH_SIZE = 25;
    const results: (PiiEntity[] | Error)[] = new Array(texts.length);

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const chunk = texts.slice(i, i + BATCH_SIZE);
      const command = new BatchDetectPiiEntitiesCommand({
        TextList: chunk,
        LanguageCode: "en",
      });

      try {
        const response = await this.client.send(command);

        // Process successful results
        if (response.ResultList) {
          for (const result of response.ResultList) {
            if (result.Index !== undefined) {
              results[i + result.Index] = result.Entities || [];
            }
          }
        }

        // Process errors for specific items in the batch
        if (response.ErrorList) {
          for (const error of response.ErrorList) {
            if (error.Index !== undefined) {
              results[i + error.Index] = new Error(
                error.ErrorMessage || "Unknown error during batch processing",
              );
            }
          }
        }
      } catch (error) {
        // If the entire batch command fails, mark all items in this chunk as failed
        const batchError =
          error instanceof Error ? error : new Error(String(error));
        for (let j = 0; j < chunk.length; j++) {
          results[i + j] = batchError;
        }
      }
    }

    return results;
  }

  /**
   * Redacts PII entities in the given text by replacing them with placeholders.
   * @param text The text to redact.
   * @param placeholder The placeholder to use (default: "[REDACTED]").
   * @returns A promise that resolves to the redacted text.
   */
  async redact(
    text: string,
    placeholder: string = "[REDACTED]",
  ): Promise<string> {
    const entities = await this.detectPii(text);
    return this.applyRedaction(text, entities, placeholder);
  }

  /**
   * Redacts PII entities in a batch of texts.
   * @param texts An array of strings to redact.
   * @param placeholder The placeholder to use (default: "[REDACTED]").
   * @returns A promise that resolves to an array of redacted strings (or original strings if error occurred).
   */
  async batchRedact(
    texts: string[],
    placeholder: string = "[REDACTED]",
  ): Promise<string[]> {
    const batchEntities = await this.batchDetectPii(texts);

    return batchEntities.map((entities, index) => {
      if (entities instanceof Error) {
        console.warn(
          `Redaction failed for item at index ${index}:`,
          entities.message,
        );
        return texts[index]; // Return original text on error
      }
      return this.applyRedaction(texts[index], entities, placeholder);
    });
  }

  /**
   * Internal helper to apply redaction based on detected entities.
   */
  private applyRedaction(
    text: string,
    entities: PiiEntity[],
    placeholder: string,
  ): string {
    if (entities.length === 0) return text;

    // Sort entities by BeginOffset in descending order to avoid offset shifts during replacement
    const sortedEntities = [...entities].sort(
      (a, b) => (b.BeginOffset || 0) - (a.BeginOffset || 0),
    );

    let redactedText = text;
    for (const entity of sortedEntities) {
      const begin = entity.BeginOffset || 0;
      const end = entity.EndOffset || 0;
      redactedText =
        redactedText.substring(0, begin) +
        placeholder +
        redactedText.substring(end);
    }

    return redactedText;
  }

  /**
   * Chaining helper to redact text before passing it to a downstream function (e.g., an LLM call).
   * @param text The text to redact.
   * @param next The function to call with the redacted text.
   * @returns A promise that resolves to the result of the next function.
   */
  async chain<T>(
    text: string,
    next: (redactedText: string) => Promise<T>,
  ): Promise<T> {
    const redactedText = await this.redact(text);
    return await next(redactedText);
  }
}
