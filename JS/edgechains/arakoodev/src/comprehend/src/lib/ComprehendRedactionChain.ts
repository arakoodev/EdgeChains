import { Observable } from "rxjs";
import { mergeMap } from "rxjs/operators";
import type {
    EndpointLike,
    EndpointChatOptions,
    RedactionOptions,
    RedactorInterface,
    ComprehendRedactionChainConfig,
} from "./types.js";

export class ComprehendRedactionChain {
    private redactor: RedactorInterface;
    private endpoint: EndpointLike;
    private defaultRedactionOptions?: RedactionOptions;

    constructor(config: ComprehendRedactionChainConfig) {
        if (!config || !config.redactor || !config.endpoint) {
            throw new Error(
                "ComprehendRedactionChain requires both 'redactor' and 'endpoint' instances."
            );
        }
        this.redactor = config.redactor;
        this.endpoint = config.endpoint;
        this.defaultRedactionOptions = config.redactionOptions;
    }

    getRedactor(): RedactorInterface {
        return this.redactor;
    }

    getEndpoint(): EndpointLike {
        return this.endpoint;
    }

    async run<T = unknown>(
        chatOptions: EndpointChatOptions,
        options?: RedactionOptions
    ): Promise<T> {
        return this.redactor.chain<T>(
            this.endpoint,
            chatOptions,
            options || this.defaultRedactionOptions
        );
    }

    runObservable<T = unknown>(
        chatOptions: EndpointChatOptions,
        options?: RedactionOptions
    ): Observable<T> {
        return this.redactor.chainObservable<T>(
            this.endpoint,
            chatOptions,
            options || this.defaultRedactionOptions
        );
    }

    toObservable<T = unknown>(
        chatOptions: EndpointChatOptions,
        options?: RedactionOptions
    ): Observable<T> {
        return this.runObservable<T>(chatOptions, options);
    }

    pipeObservable<T = unknown>(
        inputs$: Observable<string | EndpointChatOptions>,
        options?: RedactionOptions
    ): Observable<T> {
        return inputs$.pipe(this.operator<T>(options));
    }

    operator<T = unknown>(
        options?: RedactionOptions
    ): (source$: Observable<string | EndpointChatOptions>) => Observable<T> {
        return (source$: Observable<string | EndpointChatOptions>) =>
            source$.pipe(
                mergeMap((item) => {
                    const chatOptions: EndpointChatOptions =
                        typeof item === "string" ? { prompt: item } : item;
                    return this.runObservable<T>(chatOptions, options);
                })
            );
    }
}
