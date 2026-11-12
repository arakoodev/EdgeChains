import { Observable, from } from "rxjs";

export interface PiiEntitySpan {
    Type: string;
    Score: number;
    BeginOffset: number;
    EndOffset: number;
}

export interface ComprehendClientLike {
    detectPiiEntities(params: { Text: string; LanguageCode: string }): Promise<{ Entities?: PiiEntitySpan[] }>;
}

export class ComprehendRedactor {
    private client: ComprehendClientLike;
    private languageCode: string;
    private minConfidence: number;

    constructor(client: ComprehendClientLike, languageCode = "en", minConfidence = 0.75) {
        this.client = client;
        this.languageCode = languageCode;
        this.minConfidence = minConfidence;
    }

    public async redactText(input: string): Promise<string> {
        if (!input) return "";
        const res = await this.client.detectPiiEntities({ Text: input, LanguageCode: this.languageCode });
        const entities = (res.Entities ?? [])
            .filter((e) => e.Score >= this.minConfidence)
            .sort((a, b) => b.BeginOffset - a.BeginOffset);

        let redacted = input;
        for (const ent of entities) {
            redacted =
                redacted.slice(0, ent.BeginOffset) +
                `[REDACTED_${ent.Type}]` +
                redacted.slice(ent.EndOffset);
        }
        return redacted;
    }

    public chainObservable(sourceStream: Observable<string> | string): Observable<string> {
        if (typeof sourceStream === "string") {
            return from(this.redactText(sourceStream));
        }
        return new Observable<string>((subscriber) => {
            const sub = sourceStream.subscribe({
                next: (val) => {
                    this.redactText(val)
                        .then((clean) => subscriber.next(clean))
                        .catch((err) => subscriber.error(err));
                },
                error: (err) => subscriber.error(err),
                complete: () => subscriber.complete(),
            });
            return () => sub.unsubscribe();
        });
    }
}
