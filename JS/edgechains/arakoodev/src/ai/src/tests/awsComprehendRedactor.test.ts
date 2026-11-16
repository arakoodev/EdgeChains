import { describe, expect, it, vi } from "vitest";
import {
    AWSComprehendRedactor,
    type ComprehendPiiClient,
    type ComprehendPiiEntity,
    type ObservableLike,
    type ObserverLike,
} from "../lib/aws-comprehend/index.js";

function entity(text: string, value: string, type: string, score = 0.99): ComprehendPiiEntity {
    const start = text.indexOf(value);
    return {
        BeginOffset: start,
        EndOffset: start + value.length,
        Score: score,
        Type: type,
    };
}

function mockClient(entities: ComprehendPiiEntity[]): ComprehendPiiClient {
    return {
        detectPiiEntities: vi.fn(async () => ({ Entities: entities })),
    };
}

describe("AWSComprehendRedactor", () => {
    it("redacts detected PII with entity labels", async () => {
        const text = "Jane Doe emailed jane@example.com from 10.0.0.1";
        const redactor = new AWSComprehendRedactor({
            client: mockClient([
                entity(text, "Jane Doe", "NAME"),
                entity(text, "jane@example.com", "EMAIL"),
                entity(text, "10.0.0.1", "IP_ADDRESS"),
            ]),
        });

        const result = await redactor.redactText(text);

        expect(result.redactedText).toBe("[NAME] emailed [EMAIL] from [IP_ADDRESS]");
        expect(result.entities).toHaveLength(3);
    });

    it("filters low confidence and unrequested entity types", async () => {
        const text = "Jane Doe uses jane@example.com";
        const redactor = new AWSComprehendRedactor({
            client: mockClient([
                entity(text, "Jane Doe", "NAME", 0.99),
                entity(text, "jane@example.com", "EMAIL", 0.4),
            ]),
        });

        const result = await redactor.redactText(text, {
            entityTypes: ["EMAIL"],
            minScore: 0.9,
        });

        expect(result.redactedText).toBe(text);
        expect(result.entities).toHaveLength(0);
    });

    it("supports fixed and mask replacement strategies", async () => {
        const text = "Call 555-1212";
        const redactor = new AWSComprehendRedactor({
            client: mockClient([entity(text, "555-1212", "PHONE")]),
        });

        await expect(
            redactor.redactText(text, { replacementText: "<private>", strategy: "fixed" })
        ).resolves.toMatchObject({
            redactedText: "Call <private>",
        });
        await expect(
            redactor.redactText(text, { maskCharacter: "#", strategy: "mask" })
        ).resolves.toMatchObject({
            redactedText: "Call ########",
        });
    });

    it("redacts prompt and message chat options before chaining to endpoints", async () => {
        const text = "My ssn is 123-45-6789";
        const client = mockClient([entity(text, "123-45-6789", "SSN")]);
        const redactor = new AWSComprehendRedactor({ client });
        const endpoint = {
            chat: vi.fn(async (options) => ({ content: options.prompt || options.messages?.[0].content })),
        };

        const chained = redactor.chainEndpoint(endpoint);
        const response = await chained.chat({
            model: "example-model",
            prompt: text,
        });

        expect(endpoint.chat).toHaveBeenCalledWith({
            model: "example-model",
            prompt: "My ssn is [SSN]",
        });
        expect(response).toEqual({ content: "My ssn is [SSN]" });

        await redactor.redactChatOptions({
            messages: [{ role: "user", content: text }],
        });

        expect(client.detectPiiEntities).toHaveBeenCalledTimes(2);
    });

    it("maps observable-like prompt streams to redaction results", async () => {
        const text = "Email jane@example.com";
        const redactor = new AWSComprehendRedactor({
            client: mockClient([entity(text, "jane@example.com", "EMAIL")]),
        });
        const source: ObservableLike<string> = {
            subscribe(observerOrNext: ObserverLike<string> | ((value: string) => void)) {
                const observer =
                    typeof observerOrNext === "function" ? { next: observerOrNext } : observerOrNext;
                observer.next?.(text);
                observer.complete?.();
                return { unsubscribe() {} };
            },
        };

        const values = await new Promise<string[]>((resolve, reject) => {
            const collected: string[] = [];
            redactor.redactTextOperator()(source).subscribe({
                complete: () => resolve(collected),
                error: reject,
                next: (result) => collected.push(result.redactedText),
            });
        });

        expect(values).toEqual(["Email [EMAIL]"]);
    });
});
