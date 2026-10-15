import axios from "axios";
import { describe, expect, it, vi } from "vitest";
import { Palm2AI } from "../lib/palm2/palm2.js";

vi.mock("axios");

describe("Palm2AI", () => {
    it("posts generateText with x-goog-api-key and returns first candidate output", async () => {
        const requestMock = vi.fn().mockResolvedValueOnce({
            data: { candidates: [{ output: "Hello from PaLM2" }] },
        });

        // @ts-expect-error vitest mock typing
        axios.request = requestMock;

        const palm2 = new Palm2AI({ apiKey: "test_api_key" });
        const out = await palm2.chat({ prompt: "hi", model: "text-bison-001" });

        expect(out).toBe("Hello from PaLM2");
        expect(requestMock).toHaveBeenCalledTimes(1);
        expect(requestMock.mock.calls[0][0]).toMatchObject({
            method: "post",
            url: "https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generateText",
            headers: { "Content-Type": "application/json", "x-goog-api-key": "test_api_key" },
        });
    });
});

