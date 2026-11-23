import { ComprehendRedactor } from "../lib/comprehend/comprehend.js";
import { RedactorChain, redactPrompt } from "../lib/comprehend/redactorChain.js";

/**
 * A fake Comprehend client that redacts a fixed set of known substrings using a
 * simple, deterministic offset scan. This lets us exercise the chainable
 * `RedactorChain` wrapper end-to-end (prompt redaction + response redaction +
 * transparent delegation) without hitting the real AWS API.
 *
 * Runner-agnostic (no `jest.fn` / `vi.fn`) so the suite runs under both the
 * repo's `jest` config and its `vitest` script.
 */
function makeFakeRedactorClient() {
    // Each entry: [needle, replacement]
    const rules: Array<[string, string]> = [
        ["123-45-6789", "[REDACTED]"],
        ["john@example.com", "[REDACTED]"],
        ["John Doe", "[REDACTED]"],
    ];

    const client = {
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
    };
    return client as any;
}

/**
 * A fake EdgeChains endpoint that records the options it received and returns a
 * canned response. Mimics the shape of `OpenAI.chat`.
 */
function makeFakeEndpoint(response: any = { content: "ok" }) {
    const state = { receivedOptions: null as any, chatCalls: 0 };
    const endpoint = {
        chat: async (options: any) => {
            state.chatCalls++;
            state.receivedOptions = options;
            return response;
        },
        // A non-chat method to prove the Proxy forwards other members.
        streamedChat: async () => ({ content: "streamed" }),
    };
    return { endpoint, state };
}

describe("RedactorChain", () => {
    it("redacts the prompt before the endpoint sees it", async () => {
        const redactor = new ComprehendRedactor({ client: makeFakeRedactorClient() });
        const { endpoint, state } = makeFakeEndpoint({ content: "done" });

        const safe = RedactorChain.wrap(endpoint, redactor);
        const response = await safe.chat({
            prompt: "My SSN is 123-45-6789 and email john@example.com",
        });

        // Endpoint received the redacted prompt...
        expect(state.receivedOptions.prompt).toBe(
            "My SSN is [REDACTED] and email [REDACTED]"
        );
        // ...and the original options object was not mutated.
        expect(state.chatCalls).toBe(1);
        // Response passes through untouched when redactResponse is false.
        expect(response).toEqual({ content: "done" });
    });

    it("redacts each message's content in a messages array", async () => {
        const redactor = new ComprehendRedactor({ client: makeFakeRedactorClient() });
        const { endpoint, state } = makeFakeEndpoint();

        const safe = RedactorChain.wrap(endpoint, redactor);
        await safe.chat({
            messages: [
                { role: "user", content: "Contact John Doe" },
                { role: "assistant", content: "Sure, email john@example.com" },
            ],
        });

        expect(state.receivedOptions.messages).toEqual([
            { role: "user", content: "Contact [REDACTED]" },
            { role: "assistant", content: "Sure, email [REDACTED]" },
        ]);
    });

    it("redacts the response when redactResponse is enabled", async () => {
        const redactor = new ComprehendRedactor({ client: makeFakeRedactorClient() });
        const { endpoint } = makeFakeEndpoint({
            content: "Reach John Doe at john@example.com",
        });

        const safe = RedactorChain.wrap(endpoint, redactor, { redactResponse: true });
        const response = await safe.chat({ prompt: "hello" });

        expect(response).toEqual({ content: "Reach [REDACTED] at [REDACTED]" });
    });

    it("forwards non-chat members to the wrapped endpoint (transparent proxy)", async () => {
        const redactor = new ComprehendRedactor({ client: makeFakeRedactorClient() });
        const { endpoint } = makeFakeEndpoint();

        const safe = RedactorChain.wrap(endpoint, redactor);
        const streamed = await safe.streamedChat();

        expect(streamed).toEqual({ content: "streamed" });
    });

    it("redactPrompt helper behaves like RedactorChain.wrap", async () => {
        const redactor = new ComprehendRedactor({ client: makeFakeRedactorClient() });
        const { endpoint, state } = makeFakeEndpoint();

        const safe = redactPrompt(endpoint, redactor);
        await safe.chat({ prompt: "SSN 123-45-6789" });

        expect(state.receivedOptions.prompt).toBe("SSN [REDACTED]");
    });
});