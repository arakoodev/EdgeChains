export interface ComprehendPiiEntity {
    Type?: string;
    BeginOffset?: number;
    EndOffset?: number;
    Score?: number;
}

export interface DetectPiiEntitiesCommandInput {
    Text: string;
    LanguageCode: string;
}

export interface DetectPiiEntitiesCommandOutput {
    Entities?: ComprehendPiiEntity[];
}

export interface ComprehendLikeClient {
    detectPiiEntities?: (
        input: DetectPiiEntitiesCommandInput
    ) => Promise<DetectPiiEntitiesCommandOutput>;
    send?: (command: unknown) => Promise<DetectPiiEntitiesCommandOutput>;
}

export interface ComprehendRedactorOptions {
    client: ComprehendLikeClient;
    languageCode?: string;
    replacement?: string | ((entity: ComprehendPiiEntity) => string);
    minScore?: number;
    commandFactory?: (input: DetectPiiEntitiesCommandInput) => unknown;
}

export interface Observer<T> {
    next?: (value: T) => void;
    error?: (err: unknown) => void;
    complete?: () => void;
}

export interface Subscription {
    unsubscribe(): void;
}

export class SimpleObservable<T> {
    constructor(
        private readonly subscriber: (observer: Required<Observer<T>>) => (() => void) | void
    ) {}

    subscribe(observer: Observer<T> | ((value: T) => void)): Subscription {
        const obs: Required<Observer<T>> = {
            next: typeof observer === "function" ? observer : (observer.next?.bind(observer) ?? (() => {})),
            error: typeof observer === "function" ? () => {} : (observer.error?.bind(observer) ?? (() => {})),
            complete: typeof observer === "function" ? () => {} : (observer.complete?.bind(observer) ?? (() => {})),
        };

        const cleanup = this.subscriber(obs);
        return {
            unsubscribe: () => {
                if (typeof cleanup === "function") {
                    cleanup();
                }
            },
        };
    }

    toPromise(): Promise<T> {
        return new Promise((resolve, reject) => {
            let lastValue: T;
            this.subscribe({
                next: (val) => {
                    lastValue = val;
                },
                error: (err) => reject(err),
                complete: () => resolve(lastValue),
            });
        });
    }

    pipe<R>(transform: (value: T) => R | Promise<R>): SimpleObservable<R> {
        return new SimpleObservable<R>((observer) => {
            let pending = 0;
            let completed = false;

            const checkComplete = () => {
                if (completed && pending === 0) {
                    observer.complete();
                }
            };

            const sub = this.subscribe({
                next: async (val) => {
                    pending++;
                    try {
                        const result = await transform(val);
                        observer.next(result);
                    } catch (err) {
                        observer.error(err);
                    } finally {
                        pending--;
                        checkComplete();
                    }
                },
                error: (err) => observer.error(err),
                complete: () => {
                    completed = true;
                    checkComplete();
                },
            });
            return () => sub.unsubscribe();
        });
    }
}

export interface ChainedChatEndpoint<TOptions = any, TReturn = any> {
    chat: (options: TOptions) => Promise<TReturn>;
}

export class ComprehendRedactorEndpoint<TEndpoint extends ChainedChatEndpoint = ChainedChatEndpoint> {
    constructor(
        readonly redactor: ComprehendRedactor,
        readonly endpoint: TEndpoint
    ) {}

    /**
     * Intercepts prompt and/or message content in chatOptions, redacts sensitive PII via
     * AWS Comprehend, and forwards the redacted options to the chained AI endpoint.
     */
    async chat(options: any): Promise<any> {
        if (!this.endpoint || typeof this.endpoint.chat !== "function") {
            throw new Error("ComprehendRedactorEndpoint requires a valid chat endpoint");
        }

        const sanitizedOptions = { ...options };

        if (typeof options.prompt === "string") {
            sanitizedOptions.prompt = await this.redactor.redact(options.prompt);
        }

        if (Array.isArray(options.messages)) {
            sanitizedOptions.messages = await Promise.all(
                options.messages.map(async (msg: any) => {
                    if (msg && typeof msg.content === "string") {
                        return {
                            ...msg,
                            content: await this.redactor.redact(msg.content),
                        };
                    }
                    return msg;
                })
            );
        }

        return this.endpoint.chat(sanitizedOptions);
    }

    /**
     * Creates an observable that streams prompt redactions and feeds them into the chained endpoint.
     */
    observeAndChat(
        input: SimpleObservable<string> | string,
        chatOptions: Record<string, any> = {}
    ): SimpleObservable<any> {
        const prompt$ = input instanceof SimpleObservable ? input : this.redactor.observe(input);
        return prompt$.pipe((redactedPrompt) =>
            this.endpoint.chat({
                ...chatOptions,
                prompt: redactedPrompt,
            })
        );
    }
}

export class ComprehendRedactor {
    private readonly client: ComprehendLikeClient;
    private readonly languageCode: string;
    private readonly replacement: string | ((entity: ComprehendPiiEntity) => string);
    private readonly minScore: number;
    private readonly commandFactory?: (input: DetectPiiEntitiesCommandInput) => unknown;

    constructor(options: ComprehendRedactorOptions) {
        this.client = options.client;
        this.languageCode = options.languageCode || "en";
        this.replacement = options.replacement || ((entity) => `[${entity.Type || "PII"}]`);
        this.minScore = options.minScore ?? 0;
        this.commandFactory = options.commandFactory;
    }

    async redact(text: string): Promise<string> {
        if (!text) {
            return text;
        }

        const input = { Text: text, LanguageCode: this.languageCode };
        const response = await this.detectPiiEntities(input);
        const entities = this.normalizeEntities(response.Entities || [], text.length);

        return entities.reduceRight((redacted, entity) => {
            const replacement =
                typeof this.replacement === "function" ? this.replacement(entity) : this.replacement;
            return `${redacted.slice(0, entity.BeginOffset)}${replacement}${redacted.slice(
                entity.EndOffset
            )}`;
        }, text);
    }

    /**
     * Chains this redactor with an LLM chat endpoint (e.g. OpenAI, GeminiAI, LlamaAI),
     * automatically sanitizing prompts and messages before dispatch.
     */
    chain<T extends ChainedChatEndpoint>(endpoint: T): ComprehendRedactorEndpoint<T> {
        return new ComprehendRedactorEndpoint<T>(this, endpoint);
    }

    /**
     * Wraps a text prompt or stream into an Observable that emits the redacted prompt.
     */
    observe(text: string | SimpleObservable<string>): SimpleObservable<string> {
        if (text instanceof SimpleObservable) {
            return text.pipe((val) => this.redact(val));
        }

        return new SimpleObservable<string>((observer) => {
            let active = true;
            this.redact(text)
                .then((redacted) => {
                    if (active) {
                        observer.next(redacted);
                        observer.complete();
                    }
                })
                .catch((err) => {
                    if (active) {
                        observer.error(err);
                    }
                });

            return () => {
                active = false;
            };
        });
    }

    private async detectPiiEntities(
        input: DetectPiiEntitiesCommandInput
    ): Promise<DetectPiiEntitiesCommandOutput> {
        if (this.client.detectPiiEntities) {
            return this.client.detectPiiEntities(input);
        }

        if (this.client.send && this.commandFactory) {
            return this.client.send(this.commandFactory(input));
        }

        throw new Error("ComprehendRedactor requires detectPiiEntities or send plus commandFactory");
    }

    private normalizeEntities(entities: ComprehendPiiEntity[], textLength: number): Required<ComprehendPiiEntity>[] {
        return entities
            .filter((entity): entity is Required<ComprehendPiiEntity> => {
                if (typeof entity.BeginOffset !== "number" || typeof entity.EndOffset !== "number") {
                    return false;
                }
                if (entity.BeginOffset < 0 || entity.EndOffset > textLength || entity.BeginOffset >= entity.EndOffset) {
                    return false;
                }
                return (entity.Score ?? 1) >= this.minScore;
            })
            .sort((a, b) => a.BeginOffset - b.BeginOffset)
            .reduce<Required<ComprehendPiiEntity>[]>((acc, entity) => {
                const previous = acc[acc.length - 1];
                if (previous && entity.BeginOffset < previous.EndOffset) {
                    if ((entity.Score ?? 0) > (previous.Score ?? 0)) {
                        acc[acc.length - 1] = entity;
                    }
                    return acc;
                }
                acc.push(entity);
                return acc;
            }, []);
    }
}
