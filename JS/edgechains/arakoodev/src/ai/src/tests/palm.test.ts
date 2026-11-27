import axios from "axios";
import { PalmAI } from "../lib/palm/palm.js";

describe("PalmAI Endpoint (#279)", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("generateText calls PaLM 2 generateText endpoint and returns completion", async () => {
        jest.spyOn(axios, "post").mockResolvedValue({
            data: {
                candidates: [{ output: "Hello from PaLM 2!" }],
            },
        } as any);

        const palm = new PalmAI({ apiKey: "test-palm-key" });
        const result = await palm.generateText({ prompt: "Say hello" });

        expect(result.candidates[0].output).toBe("Hello from PaLM 2!");
    });

    test("chat calls PaLM 2 generateMessage endpoint", async () => {
        jest.spyOn(axios, "post").mockResolvedValue({
            data: {
                candidates: [{ author: "1", content: "Hi there!" }],
            },
        } as any);

        const palm = new PalmAI({ apiKey: "test-palm-key" });
        const result = await palm.chat({ messages: "Hello" });

        expect(result.candidates[0].content).toBe("Hi there!");
    });
});
