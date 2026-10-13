import { ComprehendClient, DetectPiiEntitiesCommand } from "@aws-sdk/client-comprehend";

/**
 * AWSComprehendPIIRedactor
 * Utilitas untuk mendeteksi dan menyunting data sensitif (PII) menggunakan AWS Comprehend.
 */
export class AWSComprehendPIIRedactor {
  private client: ComprehendClient;

  constructor(region: string, accessKeyId: string, secretAccessKey: string) {
    this.client = new ComprehendClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  /**
   * Menyunting teks dengan mengganti entitas PII yang terdeteksi dengan placeholder.
   */
  async redact(text: string, languageCode: string = "en"): Promise<string> {
    const entities = await this.detectPii(text, languageCode);
    
    // Kita urutkan entitas dari offset TERBESAR ke terkecil agar index tidak rusak saat editing
    const sortedEntities = [...entities].sort((a, b) => b.BeginOffset - a.BeginOffset);

    let redactedText = text;

    for (const entity of sortedEntities) {
      const placeholder = `[REDACTED_${entity.Type}]`;
      redactedText =
        redactedText.slice(0, entity.BeginOffset) +
        placeholder +
        redactedText.slice(entity.EndOffset);
    }

    return redactedText;
  }

  /**
   * Memanggil AWS Comprehend untuk mendeteksi entitas PII.
   */
  async detectPii(text: string, languageCode: string) {
    const command = new DetectPiiEntitiesCommand({
      Text: text,
      LanguageCode: languageCode,
    });

    try {
      const response = await this.client.send(command);
      return response.Entities || [];
    } catch (error) {
      console.error("AWS Comprehend Error:", error);
      throw error;
    }
  }
}

