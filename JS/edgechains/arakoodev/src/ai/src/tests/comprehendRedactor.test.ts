import { AwsComprehendRedactor } from "../lib/comprehend/comprehendRedactor.js";
import { ComprehendRedaction } from "../lib/comprehend/comprehendRedaction.js";

describe("AwsComprehendRedactor", () => {
    test("should redact PII entities with mock Comprehend client", async () => {
        const mockClient = {
            async send({ Text }: { Text: string }) {
                const entities = [];
                const idx = Text.indexOf("john.doe@example.com");
                if (idx !== -1) {
                    entities.push({
                        Type: "EMAIL",
                        BeginOffset: idx,
                        EndOffset: idx + "john.doe@example.com".length,
                        Score: 0.99,
                    });
                }
                return { Entities: entities };
            },
        };

        const redactor = new AwsComprehendRedactor({ client: mockClient });
        const input = "Contact john.doe@example.com immediately.";
        const output = await redactor.chain(input);

        expect(output).toBe("Contact [REDACTED_EMAIL] immediately.");
    });

    test("should mask PII using ComprehendRedaction mask character", async () => {
        const mockClient = {
            async send({ Text }: { Text: string }) {
                const idx = Text.indexOf("secret");
                return {
                    Entities: [
                        {
                            Type: "SECRET",
                            BeginOffset: idx,
                            EndOffset: idx + "secret".length,
                        },
                    ],
                };
            },
        };

        const redactor = new ComprehendRedaction({ client: mockClient, maskCharacter: "*" });
        const input = "This is a secret message.";
        const output = await redactor.observe(input);

        expect(output).toBe("This is a ****** message.");
    });

    test("should return unchanged text when no PII is present", async () => {
        const mockClient = {
            async send() {
                return { Entities: [] };
            },
        };

        const redactor = new AwsComprehendRedactor({ client: mockClient });
        const input = "Safe clean text without PII.";
        const output = await redactor.chain(input);

        expect(output).toBe(input);
    });

    test("should return empty string on empty input", async () => {
        const redactor = new AwsComprehendRedactor();
        const output = await redactor.chain("");
        expect(output).toBe("");
    });
});
