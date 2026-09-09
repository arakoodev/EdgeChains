import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "vitest";
import { ComprehendRedactor } from "../../lib/aws-comprehend/comprehendRedactor.js";

describe("ComprehendRedactor", () => {
    test("redacts PII detected by AWS Comprehend", async () => {
        const redactor = new ComprehendRedactor({
            detector: async () => ({
                Entities: [
                    { Type: "NAME", BeginOffset: 0, EndOffset: 10, Score: 0.99 },
                    { Type: "EMAIL", BeginOffset: 29, EndOffset: 42, Score: 0.98 },
                ],
            }),
        });

        const result = await redactor.redactText("Jane Smith can be emailed at jane@test.com.");

        expect(result.text).toEqual("[NAME] can be emailed at [EMAIL].");
        expect(result.entities).toHaveLength(2);
    });

    test("supports score thresholds and custom replacement text", async () => {
        const redactor = new ComprehendRedactor({
            detector: async () => ({
                Entities: [
                    { Type: "NAME", BeginOffset: 0, EndOffset: 4, Score: 0.7 },
                    { Type: "EMAIL", BeginOffset: 14, EndOffset: 27, Score: 0.96 },
                ],
            }),
            minScore: 0.9,
            replacementText: "[REDACTED]",
        });

        const result = await redactor.redactText("Jane wrote to jane@test.com");

        expect(result.text).toEqual("Jane wrote to [REDACTED]");
        expect(result.entities).toHaveLength(1);
    });

    test("redacts files", async () => {
        const directory = await mkdtemp(join(tmpdir(), "edgechains-comprehend-"));
        const inputPath = join(directory, "input.txt");
        const outputPath = join(directory, "output.txt");

        try {
            await writeFile(inputPath, "Call me at 206-555-0101", "utf8");

            const redactor = new ComprehendRedactor({
                detector: async () => ({
                    Entities: [{ Type: "PHONE", BeginOffset: 11, EndOffset: 23, Score: 0.99 }],
                }),
            });

            await redactor.redactFile(inputPath, outputPath);

            expect(await readFile(outputPath, "utf8")).toEqual("Call me at [PHONE]");
        } finally {
            await rm(directory, { recursive: true, force: true });
        }
    });
});
