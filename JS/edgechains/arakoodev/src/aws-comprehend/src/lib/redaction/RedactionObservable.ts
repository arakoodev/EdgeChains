import { firstValueFrom, of, Observable } from "rxjs";
import { mergeMap } from "rxjs/operators";
import { PiiRedactionOptions, PiiRedactor } from "../../types/index.js";

/**
 * An observable stream of PII-redacted text values.
 *
 * It wraps any upstream observable of strings - for example a prompt stream
 * produced by an existing Endpoint class - and emits each value with the
 * sensitive information removed. The class extends rxjs Observable, so it
 * can be chained with the standard operators:
 *
 * ```ts
 * const redactor = new ComprehendPiiRedactor();
 * const redacted$ = new RedactionObservable(prompt$, redactor);
 * const completion$ = redacted$.pipe(mergeMap((prompt) => openai.chat({ prompt })));
 * ```
 *
 * `RedactionObservable` also accepts a plain string as its source, which is
 * a convenient way to redact a single prompt before handing it to a chain.
 */
export class RedactionObservable extends Observable<string> {
    constructor(
        source: string | Observable<string>,
        redactor: PiiRedactor,
        options: PiiRedactionOptions = {}
    ) {
        super((subscriber) => {
            const stream = typeof source === "string" ? of(source) : source;
            return stream
                .pipe(mergeMap((text) => redactor.redact(text, options)))
                .subscribe(subscriber);
        });
    }

    /**
     * Returns the redacted value as a promise. Resolves with an empty
     * string when the stream completes without emitting a value.
     */
    async get(): Promise<string> {
        return firstValueFrom(this, { defaultValue: "" });
    }
}
