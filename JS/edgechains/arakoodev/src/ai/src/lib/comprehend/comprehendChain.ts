import { Observable, defer, from } from "rxjs";
import { map, switchMap } from "rxjs/operators";
import { AwsComprehendRedactor } from "./comprehendRedactor.js";
import type {
    EndpointLike,
    RedactResult,
} from "./types.js";

/**
 * RxJS Operator to redact PII from raw string prompts in an Observable pipeline.
 *
 * Example:
 * ```ts
 * of("Contact me at alice@example.com")
 *   .pipe(redactPiiOperator(redactor))
 *   .subscribe(cleanPrompt => console.log(cleanPrompt));
 * ```
 */
export function redactPiiOperator(
    redactor: AwsComprehendRedactor
): (source$: Observable<string>) => Observable<string> {
    return (source$: Observable<string>) =>
        source$.pipe(
            switchMap((prompt) =>
                defer(() => from(redactor.redact(prompt))).pipe(
                    map((result) => result.redactedText)
                )
            )
        );
}

/**
 * RxJS Operator to redact chat options (prompt and messages) in an Observable pipeline.
 */
export function redactChatOptionsOperator<T extends { prompt?: string; messages?: any[] }>(
    redactor: AwsComprehendRedactor
): (source$: Observable<T>) => Observable<T> {
    return (source$: Observable<T>) =>
        source$.pipe(
            switchMap((options) => defer(() => from(redactor.redactChatOptions(options))))
        );
}

/**
 * AwsComprehendRedactionChain chains AWS Comprehend PII Redaction
 * with LLM Endpoint classes (OpenAI, GeminiAI, LlamaAI) using both
 * standard Promises and cold RxJS Observables.
 */
export class AwsComprehendRedactionChain {
    public redactor: AwsComprehendRedactor;
    public endpoint?: EndpointLike;

    constructor(redactor: AwsComprehendRedactor, endpoint?: EndpointLike) {
        this.redactor = redactor;
        this.endpoint = endpoint;
    }

    /**
     * Fluent helper to chain or rebind an endpoint.
     */
    chain(endpoint: EndpointLike): AwsComprehendRedactionChain {
        return new AwsComprehendRedactionChain(this.redactor, endpoint);
    }

    /**
     * Cold Observable returning the full RedactResult.
     */
    redact$(text: string, languageCode?: string): Observable<RedactResult> {
        return defer(() => from(this.redactor.redact(text, languageCode)));
    }

    /**
     * Cold Observable emitting only the sanitized prompt string.
     */
    redactPrompt$(text: string, languageCode?: string): Observable<string> {
        return this.redact$(text, languageCode).pipe(map((res) => res.redactedText));
    }

    /**
     * Promise-based chat method that redacts prompt and messages before calling endpoint.chat().
     */
    async chat(chatOptions: any): Promise<any> {
        if (!this.endpoint) {
            throw new Error("[AwsComprehendRedactionChain] No endpoint configured in chain. Call .chain(endpoint) first.");
        }

        const sanitizedOptions = await this.redactor.redactChatOptions(chatOptions);
        return this.endpoint.chat(sanitizedOptions);
    }

    /**
     * Cold Observable pipeline for chat operations:
     * Source Options -> Redaction -> Endpoint Response
     */
    chat$(chatOptions: any): Observable<any> {
        if (!this.endpoint) {
            throw new Error("[AwsComprehendRedactionChain] No endpoint configured in chain. Call .chain(endpoint) first.");
        }

        return defer(() => from(this.redactor.redactChatOptions(chatOptions))).pipe(
            switchMap((sanitizedOptions) => {
                if (typeof this.endpoint?.chat$ === "function") {
                    return this.endpoint.chat$(sanitizedOptions);
                }
                return from(this.endpoint!.chat(sanitizedOptions));
            })
        );
    }

    /**
     * Promise-based streamedChat method that sanitizes prompts before calling endpoint.streamedChat().
     */
    async streamedChat(chatOptions: any): Promise<any> {
        if (!this.endpoint || typeof this.endpoint.streamedChat !== "function") {
            throw new Error("[AwsComprehendRedactionChain] Endpoint does not support streamedChat.");
        }

        const sanitizedOptions = await this.redactor.redactChatOptions(chatOptions);
        return this.endpoint.streamedChat(sanitizedOptions);
    }

    /**
     * Support for schema-constrained calls (like OpenAI zodSchemaResponse in EdgeChains).
     */
    async zodSchemaResponse(options: any): Promise<any> {
        if (!this.endpoint || typeof this.endpoint.zodSchemaResponse !== "function") {
            throw new Error("[AwsComprehendRedactionChain] Endpoint does not support zodSchemaResponse.");
        }

        const sanitizedOptions = await this.redactor.redactChatOptions(options);
        return this.endpoint.zodSchemaResponse(sanitizedOptions);
    }
}
