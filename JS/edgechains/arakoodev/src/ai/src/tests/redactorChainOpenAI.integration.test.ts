import axios from "axios";
import { OpenAI } from "../lib/openai/openai.js";
import { ComprehendRedactor } from "../lib/comprehend/comprehend.js";
import { RedactorChain } from "../lib/comprehend/redactorChain.js";

/**
 * Integration test proving that `RedactorChain` genuinely chains with a REAL
 * EdgeChains `Endpoint` class (`OpenAI`), not just a hand-rolled fake.
 *
 * `axios` is mocked so no network call is made, but the *actual* `OpenAI.chat`
 * implementation runs — which means we can assert on the exact request body that
 * OpenAI would have sent to the provider and prove the PII was scrubbed before
 * it ever left the process.
 *
 * Runner-agnostic (no `jest.fn` / `vi.fn`) so it runs under both `jest` and the
 * repo's `vitest` script.
 */

// Minimal structural type for the captured axios call.
interface CapturedRequest {
    url: string;
    body: any;
    config: any;
}

/**
 * Install a fake axios.post that records the request and returns a canned
 * OpenAI-shaped response. Returns an array that captures the single call.
 */
function mockAxios(captured: CapturedRequest[], responseContent: string) {
    (axios as any).post = async (url: string, body: any, config: any) => {
        captured.push({ url, body, config });
        return {
            data: {
                choices: [{ message: { role: "assistant", content: responseContent } }],
            },
        };
    };
}

function makeFakeComprehendClient() {
    const rules: Array<[string, string]> = [
        ["123-45-6789", "[REDACTED]"],
        ["john@example.com", "[REDACTED]"],
        ["John Doe", "[REDACTED]"],
    ];
    return {
        send: async (command: any) => {
            const text: string = command.input.Text;
            const entities: Array<any> = [];
            for (const [needle, replacement] of rules) {
                let from = 0;
                let idx = text.indexOf(needle, from);
                while (idx !== -1) {
                    entities.push({
                        Type: "NAME",
                        BeginOffset: idx,
                        EndOffset: idx + needle.length,
                        Score: 0.99,
                        _replacement: replacement,
                    });
                    from = idx + needle.length;
                    idx = text.indexOf(needle, from);
                }
            }
            return { Entities: entities };
        },
    } as any;
}

describe("RedactorChain with the real OpenAI Endpoint", () => {
    it("redacts the prompt before the real OpenAI.chat sends the request", async () => {
        const captured: CapturedRequest[] = [];
        mockAxios(captured, "Here is your masked profile.");

        const openai = new OpenAI({ apiKey: "test_key", orgId: "test_org" });
        const redactor = new ComprehendRedactor({ client: makeFakeComprehendClient() });

        // Chain the redactor in front of the REAL OpenAI endpoint.
        const safe = RedactorChain.wrap(openai, redactor);

        const response = await safe.chat({
            prompt: "My name is John Doe, SSN 123-45-6789, email john@example.com",
        });

        // Exactly one outbound HTTP request was made by the real OpenAI.chat.
        expect(captured.length).toBe(1);
        expect(captured[0].url).toBe("https://api.openai.com/v1/chat/completions");

        // The message content OpenAI actually sent is fully redacted.
        const sentMessage = captured[0].body.messages[0];
        expect(sentMessage.role).toBe("user");
        expect(sentMessage.content).toBe(
            "My name is [REDACTED], SSN [REDACTED], email [REDACTED]"
        );
        // No raw PII leaked into the outbound request body.
        expect(JSON.stringify(captured[0].body)).not.toContain("john@example.com");
        expect(JSON.stringify(captured[0].body)).not.toContain("123-45-6789");
        expect(JSON.stringify(captured[0].body)).not.toContain("John Doe");

        // The real OpenAI.chat return shape flows back through unchanged.
        expect(response).toEqual({ role: "assistant", content: "Here is your masked profile." });
    });

    it("redacts each message when the real OpenAI.chat is given a messages array", async () => {
        const captured: CapturedRequest[] = [];
        mockAxios(captured, "ok");

        const openai = new OpenAI({ apiKey: "test_key", orgId: "test_org" });
        const redactor = new ComprehendRedactor({ client: makeFakeComprehendClient() });
        const safe = RedactorChain.wrap(openai, redactor);

        await safe.chat({
            messages: [
                { role: "user", content: "Contact John Doe" },
                { role: "user", content: "Email john@example.com" },
            ],
        });

        const sent = captured[0].body.messages;
        expect(sent[0].content).toBe("Contact [REDACTED]");
        expect(sent[1].content).toBe("Email [REDACTED]");
    });

    it("still forwards non-chat methods (streamedChat) on the real endpoint", async () => {
        const captured: CapturedRequest[] = [];
        mockAxios(captured, "streamed");

        const openai = new OpenAI({ apiKey: "test_key", orgId: "test_org" });
        const redactor = new ComprehendRedactor({ client: makeFakeComprehendClient() });
        const safe = RedactorChain.wrap(openai, redactor);

        // streamedChat is not intercepted; it delegates to the real OpenAI.
        const response = await safe.streamedChat({ prompt: "hello" });
        expect(response).toEqual({ role: "assistant", content: "streamed" });
        expect(captured.length).toBe(1);
    });
});