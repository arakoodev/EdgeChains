import { AWSComprehend } from "./comprehend.js";
import { RedactOptions } from "./comprehend.js";

/**
 * Redaction middleware that can be chained with AI endpoints
 * Automatically redacts PII before sending prompts to AI models
 */
export class RedactionMiddleware {
    private comprehend: AWSComprehend;
    private defaultOptions: Omit<RedactOptions, "text">;

    constructor(
        comprehend: AWSComprehend,
        defaultOptions: Omit<RedactOptions, "text"> = {}
    ) {
        this.comprehend = comprehend;
        this.defaultOptions = defaultOptions;
    }

    /**
     * Wrap an AI endpoint call with automatic PII redaction
     * @param prompt The user prompt that may contain PII
     * @param endpointCall The AI endpoint function to call with redacted prompt
     * @param options Optional redaction options to override defaults
     */
    async execute<T>(
        prompt: string,
        endpointCall: (redactedPrompt: string) => Promise<T>,
        options?: Omit<RedactOptions, "text">
    ): Promise<{
        result: T;
        redactionInfo: {
            originalPrompt: string;
            redactedPrompt: string;
            entitiesFound: Array<{
                type: string;
                score: number;
            }>;
        };
    }> {
        const redactOptions = { ...this.defaultOptions, ...options };
        const redactionResult = await this.comprehend.redact({
            text: prompt,
            ...redactOptions,
        });

        const result = await endpointCall(redactionResult.redactedText);

        return {
            result,
            redactionInfo: {
                originalPrompt: redactionResult.originalText,
                redactedPrompt: redactionResult.redactedText,
                entitiesFound: redactionResult.entitiesFound.map((e) => ({
                    type: e.type,
                    score: e.score,
                })),
            },
        };
    }

    /**
     * Create a wrapped version of an endpoint that automatically redacts
     * @param endpoint The endpoint function to wrap
     */
    wrap<T>(
        endpoint: (prompt: string) => Promise<T>
    ): (prompt: string) => Promise<T> {
        return async (prompt: string) => {
            const result = await this.execute(prompt, endpoint);
            return result.result;
        };
    }
}

/**
 * Factory function to create a redaction middleware
 */
export function createRedactionMiddleware(
    comprehendOptions?: ConstructorParameters<typeof AWSComprehend>[0],
    defaultRedactOptions?: Omit<RedactOptions, "text">
): RedactionMiddleware {
    const comprehend = new AWSComprehend(comprehendOptions);
    return new RedactionMiddleware(comprehend, defaultRedactOptions);
}
