import type {
    PiiEntity,
    PiiEntityType,
    LanguageCode,
    ComprehendClient,
} from "@aws-sdk/client-comprehend";
import type { Observable } from "rxjs";

export type { PiiEntity, PiiEntityType, LanguageCode };

export type RedactionMaskMode = "REPLACE_WITH_PII_ENTITY_TYPE" | "MASK" | "CUSTOM";

export interface ComprehendClientLike {
    send?: (command: unknown) => Promise<{ Entities?: PiiEntity[] }>;
    detectPiiEntities?: (args: {
        Text: string;
        LanguageCode: string;
    }) => Promise<{ Entities?: PiiEntity[] }>;
}

export interface AWSComprehendRedactorConfig {
    region?: string;
    credentials?: {
        accessKeyId: string;
        secretAccessKey: string;
        sessionToken?: string;
    };
    client?: ComprehendClient | ComprehendClientLike;
    defaultLanguageCode?: LanguageCode | string;
    defaultMaskMode?: RedactionMaskMode;
    defaultMaskCharacter?: string;
    defaultScoreThreshold?: number;
    defaultEntityTypes?: (PiiEntityType | string)[];
    customPlaceholder?: string | ((entity: PiiEntity, originalSubstring: string) => string);
    chunkSizeBytes?: number;
}

export interface RedactionOptions {
    languageCode?: LanguageCode | string;
    maskMode?: RedactionMaskMode;
    maskCharacter?: string;
    scoreThreshold?: number;
    entityTypes?: (PiiEntityType | string)[];
    customPlaceholder?: string | ((entity: PiiEntity, originalSubstring: string) => string);
    chunkSizeBytes?: number;
}

export interface RedactionResult {
    redactedText: string;
    originalText: string;
    entities: PiiEntity[];
    redactedEntityCount: number;
}

export interface ChatMessage {
    role: string;
    content: string;
    name?: string;
    [key: string]: unknown;
}

export interface EndpointChatOptions {
    prompt?: string;
    content?: string;
    messages?: ChatMessage[];
    [key: string]: unknown;
}

export interface EndpointLike {
    chat?: (options: EndpointChatOptions) => Promise<unknown> | unknown;
    streamedChat?: (options: EndpointChatOptions) => Promise<unknown> | unknown;
    makeRequest?: (options: EndpointChatOptions) => Promise<unknown> | unknown;
    chatObservable?: (options: EndpointChatOptions) => Observable<unknown>;
    [key: string]: unknown;
}

export interface RedactorInterface {
    redact(text: string, options?: RedactionOptions): Promise<string>;
    redactDetailed(text: string, options?: RedactionOptions): Promise<RedactionResult>;
    redactMessages(messages: ChatMessage[], options?: RedactionOptions): Promise<ChatMessage[]>;
    redactObservable(
        input: string | Observable<string>,
        options?: RedactionOptions
    ): Observable<string>;
    operator(options?: RedactionOptions): (source$: Observable<string>) => Observable<string>;
    chain<T = unknown>(
        endpoint: EndpointLike,
        chatOptions: EndpointChatOptions,
        options?: RedactionOptions
    ): Promise<T>;
    chainObservable<T = unknown>(
        endpoint: EndpointLike,
        chatOptions: EndpointChatOptions,
        options?: RedactionOptions
    ): Observable<T>;
    wrap<T extends EndpointLike>(endpoint: T, defaultOptions?: RedactionOptions): T;
}

export interface ComprehendRedactionChainConfig {
    redactor: RedactorInterface;
    endpoint: EndpointLike;
    redactionOptions?: RedactionOptions;
}
