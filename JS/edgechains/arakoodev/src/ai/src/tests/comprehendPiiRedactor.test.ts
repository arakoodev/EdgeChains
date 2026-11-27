import { describe, expect, it, vi } from "vitest";
import {
    ComprehendPiiRedactor,
    signAwsComprehendRequest,
    type ComprehendClientLike,
    type RedactionEvent,
} from "../lib/comprehend/comprehendPiiRedactor";

describe("ComprehendPiiRedactor & RedactedEndpointChain (#290)", () => {
    const samplePrompt = "Hello, my name is Alice Walker, my email is alice@example.com and my SSN is 123-45-6789.";
    const mockClient: ComprehendClientLike = {
        detectPiiEntities: vi.fn(async ({ Text }) => {
            const entities = [];
            const nameIdx = Text.indexOf("Alice Walker");
            if (nameIdx !== -1) {
                entities.push({ BeginOffset: nameIdx, EndOffset: nameIdx + 12, Score: 0.99, Type: "NAME" });
            }
            const emailIdx = Text.indexOf("alice@example.com");
            if (emailIdx !== -1) {
                entities.push({ BeginOffset: emailIdx, EndOffset: emailIdx + 17, Score: 0.98, Type: "EMAIL" });
            }
            const ssnIdx = Text.indexOf("123-45-6789");
            if (ssnIdx !== -1) {
                entities.push({ BeginOffset: ssnIdx, EndOffset: ssnIdx + 11, Score: 0.99, Type: "SSN" });
            }
            return { Entities: entities };
        }),
    };

    it("redacts PII entities with TYPE_TAG mode and emits observable RedactionEvents", async () => {
        const redactor = new ComprehendPiiRedactor({ client: mockClient, maskMode: "TYPE_TAG" });
        const events: RedactionEvent[] = [];
        const sub = redactor.subscribe((ev) => events.push(ev));

        const redacted = await redactor.redactText(samplePrompt);
        sub.unsubscribe();

        expect(redacted).toBe("Hello, my name is [NAME], my email is [EMAIL] and my SSN is [SSN].");
        expect(events).toHaveLength(1);
        expect(events[0]!.entities).toHaveLength(3);
        expect(events[0]!.redactedText).toBe(redacted);
    });

    it("supports CHARACTER masking mode and piiTypes filtering", async () => {
        const redactor = new ComprehendPiiRedactor({
            client: mockClient,
            maskMode: "CHARACTER",
            maskCharacter: "*",
            piiTypes: ["SSN"],
        });

        const redacted = await redactor.redactText(samplePrompt);
        expect(redacted).toBe(
            "Hello, my name is Alice Walker, my email is alice@example.com and my SSN is ***********."
        );
    });

    it("chains as an observable with an Endpoint class (OpenAI.chat) and redacts both prompt and messages before calling the endpoint", async () => {
        const fakeOpenAiEndpoint = {
            chat: vi.fn(async (opts: any) => ({
                content: `Echo: ${opts.prompt || opts.messages?.[0]?.content}`,
            })),
        };

        const redactor = new ComprehendPiiRedactor({ client: mockClient });
        const chainedEndpoint = redactor.chain(fakeOpenAiEndpoint);
        const observed: RedactionEvent[] = [];
        chainedEndpoint.subscribe({ next: (ev) => observed.push(ev) });

        const res1 = await chainedEndpoint.chat({ prompt: samplePrompt });
        expect(res1.content).toBe("Echo: Hello, my name is [NAME], my email is [EMAIL] and my SSN is [SSN].");
        expect(fakeOpenAiEndpoint.chat).toHaveBeenCalledWith({
            prompt: "Hello, my name is [NAME], my email is [EMAIL] and my SSN is [SSN].",
        });

        const res2 = await chainedEndpoint.chat({
            messages: [{ role: "user", content: "Contact Alice Walker at alice@example.com" }],
        });
        expect(res2.content).toBe("Echo: Contact [NAME] at [EMAIL]");
        expect(observed).toHaveLength(2);
    });

    it("computes deterministic AWS Signature V4 headers for ComprehendService_20171127.DetectPiiEntities", () => {
        const headers = signAwsComprehendRequest({
            region: "us-east-1",
            accessKeyId: "AKIAIOSFODNN7EXAMPLE",
            secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
            body: JSON.stringify({ Text: "Alice", LanguageCode: "en" }),
            amzDate: "20261023T030000Z",
        });
        expect(headers["x-amz-target"]).toBe("ComprehendService_20171127.DetectPiiEntities");
        expect(headers["host"]).toBe("comprehend.us-east-1.amazonaws.com");
        expect(headers["Authorization"]).toMatch(
            /^AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE\/20261023\/us-east-1\/comprehend\/aws4_request, SignedHeaders=content-type;host;x-amz-date;x-amz-target, Signature=[a-f0-9]{64}$/
        );
    });
});
