import { Comprehend } from "../../../../../dist/comprehend/src/lib/comprehend/comprehend.js";
import { ComprehendClient } from "@aws-sdk/client-comprehend";

jest.mock("@aws-sdk/client-comprehend", () => ({
    ComprehendClient: jest.fn().mockImplementation(() => ({ send: jest.fn() })),
    DetectPiiEntitiesCommand: jest.fn().mockImplementation((input) => ({ input })),
}));

describe("Comprehend", () => {
    describe("applyRedaction (offset handling)", () => {
        it("replaces a single entity with the default [TYPE] mask", () => {
            const text = "Email me at john@doe.com please";
            const entities = [{ Type: "EMAIL", BeginOffset: 12, EndOffset: 24, Score: 0.99 }];
            expect(Comprehend.applyRedaction(text, entities)).toBe("Email me at [EMAIL] please");
        });

        it("replaces multiple entities without shifting later offsets", () => {
            const text = "John lives at 5th Ave and his ssn is 111-22-3333";
            const entities = [
                { Type: "NAME", BeginOffset: 0, EndOffset: 4 },
                { Type: "ADDRESS", BeginOffset: 14, EndOffset: 21 },
                { Type: "SSN", BeginOffset: 37, EndOffset: 48 },
            ];
            expect(Comprehend.applyRedaction(text, entities)).toBe(
                "[NAME] lives at [ADDRESS] and his ssn is [SSN]"
            );
        });

        it("supports a custom mask function", () => {
            const text = "call 555-0100";
            const entities = [{ Type: "PHONE", BeginOffset: 5, EndOffset: 13 }];
            const masked = Comprehend.applyRedaction(text, entities, () => "***");
            expect(masked).toBe("call ***");
        });

        it("returns the text untouched when there are no entities", () => {
            expect(Comprehend.applyRedaction("nothing private here", [])).toBe(
                "nothing private here"
            );
        });

        it("ignores entities with invalid or out-of-range offsets", () => {
            const text = "safe text";
            const entities = [
                { Type: "NAME", BeginOffset: 5, EndOffset: 2 }, // begin >= end
                { Type: "NAME", BeginOffset: -1, EndOffset: 3 }, // negative begin
                { Type: "NAME", BeginOffset: 0, EndOffset: 999 }, // end past length
            ];
            expect(Comprehend.applyRedaction(text, entities)).toBe("safe text");
        });
    });

    describe("redact (chains detection + redaction)", () => {
        it("calls Comprehend and redacts the detected PII", async () => {
            const comprehend = new Comprehend({ accessKeyId: "x", secretAccessKey: "y" });
            // Inject the mocked send response.
            (comprehend as any).client.send = jest.fn().mockResolvedValueOnce({
                Entities: [{ Type: "EMAIL", BeginOffset: 9, EndOffset: 21, Score: 0.99 }],
            });

            const result = await comprehend.redact("contact me@example.org now");
            expect(result).toBe("contact [EMAIL] now");
        });

        it("returns empty string for empty input without calling AWS", async () => {
            const comprehend = new Comprehend({ accessKeyId: "x", secretAccessKey: "y" });
            const send = jest.fn();
            (comprehend as any).client.send = send;

            const result = await comprehend.redact("");
            expect(result).toBe("");
            expect(send).not.toHaveBeenCalled();
        });
    });
});
