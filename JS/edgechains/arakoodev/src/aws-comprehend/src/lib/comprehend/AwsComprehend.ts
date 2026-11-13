import {
    ComprehendClient as SdkComprehendClient,
    DetectPiiEntitiesCommand,
} from "@aws-sdk/client-comprehend";
import {
    ComprehendClientOptions,
    LanguageCode,
    PiiDetectionOptions,
    PiiEntity,
} from "../../types/index.js";

/**
 * The synchronous DetectPiiEntities API accepts at most 100 KB of UTF-8
 * encoded text per request.
 * @see https://docs.aws.amazon.com/comprehend/latest/dg/guidelines-and-limits.html
 */
const DEFAULT_MAX_DOCUMENT_BYTES = 100_000;

/**
 * Splits `text` into chunks of at most `maxBytes` UTF-8 bytes. Chunks always
 * end at a whitespace boundary when possible so that a PII entity is less
 * likely to be cut in half.
 */
export const splitIntoChunks = (text: string, maxBytes: number): string[] => {
    const encoder = new TextEncoder();
    if (encoder.encode(text).length <= maxBytes) {
        return [text];
    }

    const chunks: string[] = [];
    let current = "";
    const pushChunk = () => {
        if (current.length > 0) {
            chunks.push(current);
            current = "";
        }
    };

    const pushOversizedToken = (token: string) => {
        // A single token larger than the limit: split it on the byte boundary.
        let piece = "";
        for (const char of token) {
            if (encoder.encode(piece + char).length > maxBytes) {
                chunks.push(piece);
                piece = char;
            } else {
                piece += char;
            }
        }
        if (piece.length > 0) {
            chunks.push(piece);
        }
    };

    const tokens = text.split(/(\s+)/);
    for (const token of tokens) {
        if (encoder.encode(token).length > maxBytes) {
            pushOversizedToken(token);
            continue;
        }

        const candidate = current + token;
        if (encoder.encode(candidate).length > maxBytes) {
            pushChunk();
            current = token;
        } else {
            current = candidate;
        }
    }

    pushChunk();
    return chunks;
};

interface DetectPiiEntitiesResult {
    Entities?: {
        Score?: number;
        Type?: string;
        BeginOffset?: number;
        EndOffset?: number;
    }[];
}

/**
 * Thin wrapper over the AWS SDK Comprehend client that provides PII entity
 * detection. Texts larger than the synchronous API limit are transparently
 * split into chunks and the detected offsets are rewritten to be relative to
 * the original document.
 */
export class AwsComprehend {
    private readonly client: { send(command: unknown): Promise<unknown> };
    private readonly maxDocumentBytes: number;

    constructor(options: ComprehendClientOptions = {}) {
        if (options.client) {
            this.client = options.client;
        } else {
            const clientConfig: {
                region?: string;
                credentials?: {
                    accessKeyId: string;
                    secretAccessKey: string;
                    sessionToken?: string;
                };
            } = {};
            if (options.region) {
                clientConfig.region = options.region;
            }
            if (options.credentials?.accessKeyId && options.credentials?.secretAccessKey) {
                clientConfig.credentials = {
                    accessKeyId: options.credentials.accessKeyId,
                    secretAccessKey: options.credentials.secretAccessKey,
                    sessionToken: options.credentials.sessionToken,
                };
            }
            this.client = new SdkComprehendClient(clientConfig);
        }
        this.maxDocumentBytes = options.maxDocumentBytes ?? DEFAULT_MAX_DOCUMENT_BYTES;
    }

    /**
     * Detects PII entities in `text`. Offsets in the returned entities point
     * into the original `text` string, even when the text had to be sent to
     * Amazon Comprehend in several chunks.
     */
    async detectPiiEntities(text: string, options: PiiDetectionOptions = {}): Promise<PiiEntity[]> {
        if (!text || text.length === 0) {
            return [];
        }

        const language: LanguageCode = options.language ?? "en";
        const entities: PiiEntity[] = [];
        let offset = 0;

        for (const chunk of splitIntoChunks(text, this.maxDocumentBytes)) {
            const response = (await this.client.send(
                new DetectPiiEntitiesCommand({ Text: chunk, LanguageCode: language })
            )) as DetectPiiEntitiesResult;

            for (const entity of response.Entities ?? []) {
                const beginOffset = entity.BeginOffset ?? -1;
                const endOffset = entity.EndOffset ?? -1;
                if (beginOffset < 0 || endOffset < beginOffset) {
                    continue;
                }

                entities.push({
                    type: entity.Type ?? "UNKNOWN",
                    score: entity.Score ?? 0,
                    beginOffset: offset + beginOffset,
                    endOffset: offset + endOffset,
                });
            }

            offset += chunk.length;
        }

        return entities;
    }
}
