import { describe, expect, it, vi } from "vitest";

import { AwsComprehend, splitIntoChunks } from "../../lib/comprehend/AwsComprehend.js";

const commandWithText = (text: string) => {
    const send = vi.fn(async (command: unknown) => {
        const input = (command as { input: { Text: string; LanguageCode: string } }).input;
        return {
            Entities: [
                {
                    Score: 0.99,
                    Type: "EMAIL",
                    BeginOffset: input.Text.indexOf("jane@example.com"),
                    EndOffset: input.Text.indexOf("jane@example.com") + "jane@example.com".length,
                },
            ],
        };
    });
    return { send, client: { send } };
};

describe("splitIntoChunks", () => {
    it("returns the text unsplit when it fits the limit", () => {
        expect(splitIntoChunks("hello world", 100_000)).toEqual(["hello world"]);
    });

    it("splits on whitespace boundaries", () => {
        const chunks = splitIntoChunks("aaa bbb ccc", 7);
        expect(chunks).toEqual(["aaa bbb", " ccc"]);
    });

    it("hard-splits a single oversized token on the byte limit", () => {
        const token = "a".repeat(10);
        const chunks = splitIntoChunks(token, 4);
        expect(chunks).toEqual(["aaaa", "aaaa", "aa"]);
    });

    it("handles multi-byte characters using the byte limit", () => {
        const text = "ααααα"; // each alpha is 2 bytes in UTF-8
        const chunks = splitIntoChunks(text, 6);
        expect(chunks).toEqual(["ααα", "αα"]);
    });
});

describe("AwsComprehend", () => {
    it("detects PII entities within a single document", async () => {
        const { send, client } = commandWithText(
            "Reachable at jane@example.com, Monday to Friday."
        );
        const comprehend = new AwsComprehend({ client });

        const entities = await comprehend.detectPiiEntities(
            "Reachable at jane@example.com, Monday to Friday.",
            { language: "en" }
        );

        expect(send).toHaveBeenCalledTimes(1);
        expect(entities).toEqual([
            {
                type: "EMAIL",
                score: 0.99,
                beginOffset: 13,
                endOffset: 29,
            },
        ]);
    });

    it("returns an empty list for empty input", async () => {
        const { client } = commandWithText("");
        const comprehend = new AwsComprehend({ client });

        expect(await comprehend.detectPiiEntities("")).toEqual([]);
    });

    it("chunks large documents and rewrites offsets to document coordinates", async () => {
        const calls: string[] = [];
        const client = {
            send: vi.fn(async (command: unknown) => {
                const input = (command as { input: { Text: string; LanguageCode: string } }).input;
                calls.push(input.Text);
                // one entity spanning the whole chunk
                return {
                    Entities: [
                        {
                            Score: 0.95,
                            Type: "PHONE",
                            BeginOffset: 0,
                            EndOffset: input.Text.length,
                        },
                    ],
                };
            }),
        };
        const comprehend = new AwsComprehend({ client, maxDocumentBytes: 10 });

        const text = "first line of text second line more text";
        const entities = await comprehend.detectPiiEntities(text);

        expect(calls.length).toBeGreaterThan(1);
        expect(calls.join("")).toBe(text);

        let offset = 0;
        calls.forEach((chunk, index) => {
            const entity = entities[index];
            expect(entity).toEqual({
                type: "PHONE",
                score: 0.95,
                beginOffset: offset,
                endOffset: offset + chunk.length,
            });
            expect(text.substring(entity.beginOffset, entity.endOffset)).toBe(chunk);
            offset += chunk.length;
        });
    });

    it("passes the language code to the API and skips invalid entities", async () => {
        const send = vi.fn(async (command: unknown) => {
            const input = (command as { input: { LanguageCode: string } }).input;
            expect(input.LanguageCode).toBe("fr");
            return {
                Entities: [
                    { Score: 0.9, Type: "SSN", BeginOffset: 5, EndOffset: 2 },
                    { Score: 0.8, Type: "NAME" },
                ],
            };
        });
        const comprehend = new AwsComprehend({ client: { send } });

        expect(await comprehend.detectPiiEntities("texte", { language: "fr" })).toEqual([]);
    });
});
