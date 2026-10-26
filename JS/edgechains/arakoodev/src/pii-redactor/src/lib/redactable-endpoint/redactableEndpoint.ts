import { AWSComprehendRedactor, RedactionResult } from "../aws-comprehend/awsComprehendRedactor.js";

interface ChatOptions {
    prompt?: string;
    messages?: Array<{ role: string; content: string }>;
    [key: string]: any;
}

interface ChatResult {
    content: string;
    [key: string]: any;
}

interface ChainableEndpoint {
    chat(options: ChatOptions): Promise<ChatResult>;
    streamedChat?(options: ChatOptions): Promise<ChatResult>;
}

/**
 * RedactableEndpoint — wraps any AI endpoint and redacts PII from prompts
 * before they reach the underlying model. Chainable: the output of one
 * redactor feeds into the next, and the final result passes through to the
 * wrapped endpoint.
 *
 * Usage:
 *   const safe = new RedactableEndpoint(openAiClient, redactor);
 *   const result = await safe.chat({ prompt: "My SSN is 123-45-6789" });
 *   // prompt sent to OpenAI is "My SSN is [REDACTED:SSN]"
 */
export class RedactableEndpoint {
    private endpoint: ChainableEndpoint;
    private redactor: AWSComprehendRedactor;
    private onRedact?: (result: RedactionResult) => void;

    constructor(
        endpoint: ChainableEndpoint,
        redactor: AWSComprehendRedactor,
        onRedact?: (result: RedactionResult) => void
    ) {
        this.endpoint = endpoint;
        this.redactor = redactor;
        this.onRedact = onRedact;
    }

    /**
     * Chain another redactor after this one. Returns a new RedactableEndpoint
     * whose output is the input of the next.
     */
    pipe(next: RedactableEndpoint): RedactableEndpoint {
        const self = this;
        const chained: ChainableEndpoint = {
            async chat(options: ChatOptions): Promise<ChatResult> {
                const first = await self.chat(options);
                return next.chat({ prompt: first.content });
            },
        };
        return new RedactableEndpoint(chained, next.redactor, next.onRedact);
    }

    private async redactOptions(options: ChatOptions): Promise<ChatOptions> {
        const redacted = { ...options };

        if (options.prompt) {
            const result = await this.redactor.redact(options.prompt);
            redacted.prompt = result.redactedText;
            this.onRedact?.(result);
        }

        if (options.messages) {
            redacted.messages = await Promise.all(
                options.messages.map(async (msg) => {
                    const result = await this.redactor.redact(msg.content);
                    this.onRedact?.(result);
                    return { ...msg, content: result.redactedText };
                })
            );
        }

        return redacted;
    }

    async chat(options: ChatOptions): Promise<ChatResult> {
        const safeOptions = await this.redactOptions(options);
        return this.endpoint.chat(safeOptions);
    }

    async streamedChat(options: ChatOptions): Promise<ChatResult> {
        const safeOptions = await this.redactOptions(options);
        if (this.endpoint.streamedChat) {
            return this.endpoint.streamedChat(safeOptions);
        }
        return this.endpoint.chat(safeOptions);
    }
}
