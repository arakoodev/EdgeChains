import { describe, expect, it, vi } from "vitest";

import { ComprehendPiiRedactor } from "../../lib/redaction/ComprehendPiiRedactor.js";
import { PiiEntity } from "../../types/index.js";

/**
 * Builds an injectable command executor that returns the given entities
 * using the raw DetectPiiEntities response shape.
 */
const clientReturning = (entities: PiiEntity[]) => {
    const send = vi.fn(async () => ({
        Entities: entities.map((entity) => ({
            Score: entity.score,
            Type: entity.type,
            BeginOffset: entity.beginOffset,
            EndOffset: entity.endOffset,
        })),
    }));
    return { send, client: { send } };
};

const entity = (type: string, beginOffset: number, endOffset: number, score = 0.99): PiiEntity => ({
    type,
    score,
    beginOffset,
    endOffset,
});

const TRANSCRIPT = "Jane Smith (555-0100) can be reached at jane.doe@example.com.";

describe("ComprehendPiiRedactor", () => {
    it("replaces detected entities with typed masks", async () => {
        const { client } = clientReturning([
            entity("NAME", 0, 10),
            entity("PHONE", 12, 20),
            entity("EMAIL", 40, 60),
        ]);
        const redactor = new ComprehendPiiRedactor({ client });

        const redacted = await redactor.redact(TRANSCRIPT);

        expect(redacted).toBe("[NAME] ([PHONE]) can be reached at [EMAIL].");
    });

    it("supports a custom mask template", async () => {
        const { client } = clientReturning([entity("EMAIL", 40, 60)]);
        const redactor = new ComprehendPiiRedactor({ client });

        expect(await redactor.redact(TRANSCRIPT, { mask: "****" })).toBe(
            "Jane Smith (555-0100) can be reached at ****."
        );
    });

    it("redacts only the requested entity types", async () => {
        const { client } = clientReturning([entity("NAME", 0, 10), entity("EMAIL", 40, 60)]);
        const redactor = new ComprehendPiiRedactor({ client });

        const redacted = await redactor.redact(TRANSCRIPT, {
            entityTypes: ["EMAIL"],
        });

        expect(redacted).toBe("Jane Smith (555-0100) can be reached at [EMAIL].");
    });

    it("drops entities below the minimum score", async () => {
        const { client } = clientReturning([
            entity("NAME", 0, 10, 0.4),
            entity("EMAIL", 40, 60, 0.99),
        ]);
        const redactor = new ComprehendPiiRedactor({ client });

        const redacted = await redactor.redact(TRANSCRIPT, { minScore: 0.9 });

        expect(redacted).toBe("Jane Smith (555-0100) can be reached at [EMAIL].");
    });

    it("keeps the text unchanged when nothing is detected", async () => {
        const { client } = clientReturning([]);
        const redactor = new ComprehendPiiRedactor({ client });

        expect(await redactor.redact("no sensitive content")).toBe("no sensitive content");
    });

    it("returns text unchanged for empty input", async () => {
        const { send, client } = clientReturning([]);
        const redactor = new ComprehendPiiRedactor({ client });

        expect(await redactor.redact("")).toBe("");

        expect(send).not.toHaveBeenCalled();
    });

    it("resolves overlapping entities by preferring the longer span", async () => {
        // "Jane Smith" (0..10) overlaps the NAME candidate (6..14)
        const { client } = clientReturning([
            entity("NAME", 0, 10, 0.9),
            entity("NAME", 8, 16, 0.8),
        ]);
        const redactor = new ComprehendPiiRedactor({ client });

        const detected = await redactor.detect(TRANSCRIPT);

        expect(detected).toEqual([{ score: 0.9, type: "NAME", beginOffset: 0, endOffset: 10 }]);
        expect(await redactor.redact(TRANSCRIPT)).toBe("[NAME]" + TRANSCRIPT.substring(10));
    });

    it("detect returns entities sorted by offset", async () => {
        const { client } = clientReturning([entity("EMAIL", 40, 60), entity("NAME", 0, 10)]);
        const redactor = new ComprehendPiiRedactor({ client });

        const detected = await redactor.detect(TRANSCRIPT);

        expect(detected.map((e) => e.type)).toEqual(["NAME", "EMAIL"]);
    });

    it("ignores entities pointing outside the document", async () => {
        const { client } = clientReturning([entity("NAME", 0, Number.MAX_SAFE_INTEGER)]);
        const redactor = new ComprehendPiiRedactor({ client });

        expect(await redactor.redact(TRANSCRIPT)).toBe(TRANSCRIPT);
    });
});
