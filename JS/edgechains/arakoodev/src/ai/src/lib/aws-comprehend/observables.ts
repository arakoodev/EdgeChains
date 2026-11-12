import { Observable, OperatorFunction, defer, from, of } from "rxjs";
import { mergeMap, map } from "rxjs/operators";
import { AWSComprehend, RedactOptions, RedactResult } from "./comprehend.js";

// RxJS wrappers for AWSComprehend so redaction can be slotted into a
// pipe() chain alongside the existing Endpoint classes.
//
// Usage:
//   from(userPrompts$).pipe(
//     redactPii(comprehend),
//     mergeMap(r => from(openai.chat({ prompt: r.redactedText })))
//   ).subscribe(reply => ...)

// Cold Observable wrapper for a single redact() call. Subscribing fires
// the AWS request; resubscribing fires it again (use shareReplay to memo).
export function redact$(
    comprehend: AWSComprehend,
    options: RedactOptions
): Observable<RedactResult> {
    return defer(() => from(comprehend.redact(options)));
}

// Operator: Observable<string | RedactOptions> -> Observable<RedactResult>.
// concurrency defaults to 4 to stay under Comprehend's TPS quota.
export function redactPii(
    comprehend: AWSComprehend,
    defaults: Omit<RedactOptions, "text"> = {},
    concurrency: number = 4
): OperatorFunction<string | RedactOptions, RedactResult> {
    return (source$) =>
        source$.pipe(
            mergeMap((input) => {
                const options: RedactOptions =
                    typeof input === "string"
                        ? { ...defaults, text: input }
                        : { ...defaults, ...input };
                return redact$(comprehend, options);
            }, concurrency)
        );
}

// Same as redactPii but emits just the redacted string (drops audit data).
export function redactPiiText(
    comprehend: AWSComprehend,
    defaults: Omit<RedactOptions, "text"> = {},
    concurrency: number = 4
): OperatorFunction<string, string> {
    return (source$) =>
        source$.pipe(
            redactPii(comprehend, defaults, concurrency),
            map((result) => result.redactedText)
        );
}

// Convert an array of strings into an Observable that emits one
// RedactResult per input.
export function redactPiiBatch(
    comprehend: AWSComprehend,
    texts: string[],
    options: Omit<RedactOptions, "text"> = {},
    concurrency: number = 4
): Observable<RedactResult> {
    return of(...texts).pipe(redactPii(comprehend, options, concurrency));
}
