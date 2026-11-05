import { ComprehendClient, DetectPiiEntitiesCommand } from "@aws-sdk/client-comprehend";
import { Subject, Observable } from "rxjs";

export type ComprehendPiiEntity = {
    Score: number;
    Type: string;
    BeginOffset: number;
    EndOffset: number;
};

export type ComprehendPiiResponse = {
    Entities: ComprehendPiiEntity[];
    /** present on ContainsPiiEntities */
    RetainText?: boolean;
};

export interface ComprehendConstructionOptions {
    accessKeyId?: string;
    secretAccessKey?: string;
    region?: string;
    languageCode?: string;
    /** PII entity types to redact; default = all detected */
    redactTypes?: string[];
    /** replacement token, default "[REDACTED]" */
    replacement?: string;
}

/**
 * Amazon Comprehend PII detection + redaction utility.
 * Designed to be chained with existing Endpoint classes (as observables):
 *
 *   const chain = new ComprehendRedactor({ region: "us-east-1" });
 *   chain.redact(prompt$).subscribe((redacted) => gptEndpoint.chat({ prompt: redacted }));
 */
export class ComprehendRedactor {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    languageCode: string;
    redactTypes: string[];
    replacement: string;
    /** Optional pre-built ComprehendClient (useful for tests/mocking). */
    injectedClient?: ComprehendClient;

    constructor(options: ComprehendConstructionOptions) {
        this.accessKeyId = options.accessKeyId || process.env.AWS_ACCESS_KEY_ID || "";
        this.secretAccessKey = options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || "";
        this.region = options.region || process.env.AWS_REGION || "us-east-1";
        this.languageCode = options.languageCode || "en";
        this.redactTypes = options.redactTypes || [];
        this.replacement = options.replacement || "[REDACTED]";
    }

    /** Internal: lazily created Comprehend client (injectable for tests). */
    private _client?: ComprehendClient;

    getClient(): ComprehendClient {
        if (!this._client) {
            this._client =
                this.injectedClient ??
                new ComprehendClient({
                    region: this.region,
                    credentials: {
                        accessKeyId: this.accessKeyId,
                        secretAccessKey: this.secretAccessKey,
                    },
                });
        }
        return this._client;
    }

    /** Detect PII entities in text (Comprehend DetectPiiEntities, SigV4-signed). */
    async detectPii(text: string): Promise<ComprehendPiiEntity[]> {
        const client = this.getClient();
        const cmd = new DetectPiiEntitiesCommand({
            Text: text,
            LanguageCode: this.languageCode,
        });
        const res = await client.send(cmd);
        return (res.Entities ?? []) as ComprehendPiiEntity[];
    }

    /** Synchronous local redaction from a set of detected entities. */
    redactFromEntities(text: string, entities: ComprehendPiiEntity[]): string {
        const wanted =
            this.redactTypes.length > 0
                ? entities.filter((e) => this.redactTypes.includes(e.Type))
                : entities;
        // replace from the end so offsets stay valid
        const sorted = [...wanted].sort((a, b) => b.BeginOffset - a.BeginOffset);
        let out = text;
        for (const e of sorted) {
            out = out.slice(0, e.BeginOffset) + this.replacement + out.slice(e.EndOffset);
        }
        return out;
    }

    /** One-shot: detect + redact. */
    async redact(text: string): Promise<string> {
        const entities = await this.detectPii(text);
        return this.redactFromEntities(text, entities);
    }

    /**
     * Observable chain entry point: pipe a prompt Observable through PII
     * redaction, then feed the redacted prompt downstream (e.g. an LLM endpoint).
     */
    redactStream(prompt$: Observable<string>): Observable<string> {
        const subject = new Subject<string>();
        prompt$.subscribe({
            next: async (prompt) => {
                try {
                    subject.next(await this.redact(prompt));
                } catch (err) {
                    subject.error(err);
                }
            },
            error: (err) => subject.error(err),
            complete: () => subject.complete(),
        });
        return subject.asObservable();
    }
}
