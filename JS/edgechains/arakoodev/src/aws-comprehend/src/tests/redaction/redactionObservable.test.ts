import { describe, expect, it, vi } from "vitest";
import { Observable, concat, firstValueFrom, of, throwError } from "rxjs";
import { mergeMap } from "rxjs/operators";

import { ComprehendPiiRedactor } from "../../lib/redaction/ComprehendPiiRedactor.js";
import { RedactionObservable } from "../../lib/redaction/RedactionObservable.js";
import { PiiEntity } from "../../types/index.js";

const TRANSCRIPT = "Jane Smith (555-0100) can be reached at jane.doe@example.com.";

const REDACTED = "[NAME] ([PHONE]) can be reached at [EMAIL].";

const sampleClient = () => ({
    send: vi.fn(async () => ({
        Entities: [
            { Score: 0.99, Type: "NAME", BeginOffset: 0, EndOffset: 10 },
            { Score: 0.99, Type: "PHONE", BeginOffset: 12, EndOffset: 20 },
            { Score: 0.99, Type: "EMAIL", BeginOffset: 40, EndOffset: 60 },
        ] as object[],
    })),
});

const redactorWith = (client: { send: unknown }) =>
    new ComprehendPiiRedactor({ client: client as never });

/** Collects every value emitted by `source` and waits for completion. */
const collect = (source: Observable<string>): Promise<string[]> =>
    new Promise((resolve, reject) => {
        const values: string[] = [];
        source.subscribe({
            next: (value) => values.push(value),
            error: reject,
            complete: () => resolve(values),
        });
    });

describe("RedactionObservable", () => {
    it("redacts a plain string source", async () => {
        const chain = new RedactionObservable(TRANSCRIPT, redactorWith(sampleClient()));

        expect(await collect(chain)).toEqual([REDACTED]);
    });

    it("returns the redacted value through get()", async () => {
        const chain = new RedactionObservable(TRANSCRIPT, redactorWith(sampleClient()));

        expect(await chain.get()).toBe(REDACTED);
    });

    it("passes per-call redaction options to the redactor", async () => {
        const chain = new RedactionObservable(TRANSCRIPT, redactorWith(sampleClient()), {
            entityTypes: ["EMAIL"],
        });

        expect(await chain.get()).toBe("Jane Smith (555-0100) can be reached at [EMAIL].");
    });

    it("redacts every value of an upstream observable", async () => {
        const chain = new RedactionObservable(
            of(TRANSCRIPT, "[NAME]"),
            redactorWith(sampleClient())
        );

        expect(await collect(chain)).toEqual([REDACTED, "[NAME]"]);
    });

    it("can be chained with an endpoint class as an observable", async () => {
        // The endpoint classes of the SDK (for example OpenAI) expose async
        // methods returning a completion. mergeMap turns that promise into an
        // observable, which is how RedactionObservable composes with them.
        const endpoint = {
            chat: vi.fn(async (options: { prompt: string }) => ({
                content: `echo:${options.prompt}`,
            })),
        };

        const completion$ = new RedactionObservable(
            of(TRANSCRIPT),
            redactorWith(sampleClient())
        ).pipe(mergeMap((prompt) => endpoint.chat({ prompt })));

        expect(await firstValueFrom(completion$)).toEqual({
            content: `echo:${REDACTED}`,
        });
        expect(endpoint.chat).toHaveBeenCalledWith({ prompt: REDACTED });
    });

    it("propagates errors from the upstream source", async () => {
        const chain = new RedactionObservable(
            throwError(() => new Error("source failure")),
            redactorWith(sampleClient())
        );

        await expect(collect(chain)).rejects.toThrow("source failure");
    });

    it("propagates errors raised by the redactor", async () => {
        const send = vi.fn(async () => {
            throw new Error("comprehend failure");
        });
        const chain = new RedactionObservable(TRANSCRIPT, redactorWith({ send }));

        await expect(collect(chain)).rejects.toThrow("comprehend failure");
    });

    it("completes only after the upstream source completes", async () => {
        const chain = new RedactionObservable(
            concat(of(TRANSCRIPT), of(TRANSCRIPT)),
            redactorWith(sampleClient())
        );

        const observed = await collect(chain);

        expect(observed).toEqual([REDACTED, REDACTED]);
    });

    it("works with an empty string source without calling the API", async () => {
        const client = sampleClient();
        const chain = new RedactionObservable("", redactorWith(client));

        expect(await chain.get()).toBe("");
        expect(client.send).not.toHaveBeenCalled();
    });
});
