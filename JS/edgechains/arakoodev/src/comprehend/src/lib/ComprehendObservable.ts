import { Observable, from } from "rxjs";
import { mergeMap } from "rxjs/operators";
import type {
    EndpointLike,
    EndpointChatOptions,
    RedactionOptions,
    RedactorInterface,
    ChatMessage,
} from "./types.js";
import { ComprehendRedactionChain } from "./ComprehendRedactionChain.js";

export class ComprehendObservable {
    static redact(
        redactor: RedactorInterface,
        options?: RedactionOptions
    ): (source$: Observable<string>) => Observable<string> {
        return (source$: Observable<string>) =>
            source$.pipe(mergeMap((text) => from(redactor.redact(text, options))));
    }

    static redactMessages(
        redactor: RedactorInterface,
        options?: RedactionOptions
    ): (source$: Observable<ChatMessage[]>) => Observable<ChatMessage[]> {
        return (source$: Observable<ChatMessage[]>) =>
            source$.pipe(mergeMap((messages) => from(redactor.redactMessages(messages, options))));
    }

    static chainEndpoint<T = unknown>(
        redactor: RedactorInterface,
        endpoint: EndpointLike,
        options?: RedactionOptions
    ): (source$: Observable<string | EndpointChatOptions>) => Observable<T> {
        return (source$: Observable<string | EndpointChatOptions>) =>
            source$.pipe(
                mergeMap((item) => {
                    const chatOptions: EndpointChatOptions =
                        typeof item === "string" ? { prompt: item } : item;
                    return redactor.chainObservable<T>(endpoint, chatOptions, options);
                })
            );
    }

    static fromPrompts(
        prompts: string[],
        redactor: RedactorInterface,
        options?: RedactionOptions
    ): Observable<string> {
        return from(prompts).pipe(this.redact(redactor, options));
    }

    static createChain(
        redactor: RedactorInterface,
        endpoint: EndpointLike,
        options?: RedactionOptions
    ): ComprehendRedactionChain {
        return new ComprehendRedactionChain({
            redactor,
            endpoint,
            redactionOptions: options,
        });
    }
}
