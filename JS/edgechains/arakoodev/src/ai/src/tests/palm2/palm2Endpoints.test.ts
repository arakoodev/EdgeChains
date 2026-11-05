import { Palm2Endpoint } from "../lib/palm2/palm2";

jest.mock("axios");
import axios from "axios";
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("Palm2Endpoint", () => {
    const savedKey = process.env.PALM2_API_KEY;
    beforeEach(() => {
        process.env.PALM2_API_KEY = "test-key";
        mockedAxios.request.mockReset();
    });
    afterAll(() => {
        process.env.PALM2_API_KEY = savedKey;
    });

    it("constructs with env key by default", () => {
        const ep = new Palm2Endpoint({});
        expect((ep as any).apiKey).toBe("test-key");
    });

    it("constructs with explicit key", () => {
        const ep = new Palm2Endpoint({ apiKey: "explicit" });
        expect((ep as any).apiKey).toBe("explicit");
    });

    it("chat() posts to text-bison generateText with prompt payload", async () => {
        const ep = new Palm2Endpoint({ apiKey: "k" });
        mockedAxios.request.mockResolvedValueOnce({
            data: { candidates: [{ output: "hello world", safetyRatings: [] }] },
        });
        const res = await ep.chat({ prompt: "say hi" });
        const cfg = mockedAxios.request.mock.calls[0][0] as {
            url: string;
            headers: Record<string, string>;
            data: string;
        };
        expect(cfg.url).toContain("text-bison-001:generateText");
        expect(cfg.headers["x-goog-api-key"]).toBe("k");
        expect(JSON.parse(cfg.data).prompt.text).toBe("say hi");
        expect(res.candidates[0].output).toBe("hello world");
    });

    it("gptFn() returns first candidate output", async () => {
        const ep = new Palm2Endpoint({ apiKey: "k" });
        mockedAxios.request.mockResolvedValueOnce({
            data: { candidates: [{ output: "the answer", safetyRatings: [] }] },
        });
        const out = await ep.gptFn("q");
        expect(out).toBe("the answer");
    });

    it("gptFn() returns empty string when no candidates", async () => {
        const ep = new Palm2Endpoint({ apiKey: "k" });
        mockedAxios.request.mockResolvedValueOnce({ data: { candidates: [] } });
        const out = await ep.gptFn("q");
        expect(out).toBe("");
    });

    it("retries on failure up to max_retry", async () => {
        const ep = new Palm2Endpoint({ apiKey: "k" });
        mockedAxios.request.mockRejectedValueOnce(new Error("boom"));
        mockedAxios.request.mockResolvedValueOnce({
            data: { candidates: [{ output: "ok", safetyRatings: [] }] },
        });
        const out = await ep.gptFn("q", { max_retry: 2, delay: 1 });
        expect(out).toBe("ok");
        expect(mockedAxios.request).toHaveBeenCalledTimes(2);
    });
});
