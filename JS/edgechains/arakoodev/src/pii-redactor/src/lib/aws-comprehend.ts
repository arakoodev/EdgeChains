import { ComprehendClient, DetectPiiEntitiesCommand } from "@aws-sdk/client-comprehend";
import { Observable, from, mergeMap } from "rxjs";

export interface AwsComprehendOptions {
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
}

export class AwsComprehendPIIRedactor {
    private client: ComprehendClient;

    constructor(options?: AwsComprehendOptions) {
        this.client = new ComprehendClient({
            region: options?.region || process.env.AWS_REGION || "us-east-1",
            credentials: {
                accessKeyId: options?.accessKeyId || process.env.AWS_ACCESS_KEY_ID || "",
                secretAccessKey: options?.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || "",
            },
        });
    }

    async redact(text: string, languageCode: "en" | "es" | "fr" | "de" | "it" | "pt" | string = "en"): Promise<string> {
        if (!text) return text;
        const command = new DetectPiiEntitiesCommand({
            Text: text,
            LanguageCode: languageCode as any, // Cast to any to accept strict string literals
        });

        try {
            const response = await this.client.send(command);
            const entities = response.Entities || [];
            
            // Sort entities by offset descending to replace from end to start (prevents offset shifting)
            entities.sort((a, b) => (b.BeginOffset || 0) - (a.BeginOffset || 0));

            let redactedText = text;
            for (const entity of entities) {
                if (entity.BeginOffset !== undefined && entity.EndOffset !== undefined) {
                    const type = entity.Type || "DATA";
                    redactedText = 
                        redactedText.substring(0, entity.BeginOffset) + 
                        `[REDACTED_${type}]` + 
                        redactedText.substring(entity.EndOffset);
                }
            }
            return redactedText;
        } catch (error) {
            console.error("Error redacting PII with AWS Comprehend:", error);
            throw error;
        }
    }

    // Observable support for direct chaining
    redactObservable(text: string, languageCode: string = "en"): Observable<string> {
        return from(this.redact(text, languageCode));
    }

    // RxJS Operator for chaining in a `.pipe()`
    createRedactionOperator(languageCode: string = "en") {
        return mergeMap((text: string) => from(this.redact(text, languageCode)));
    }
}
