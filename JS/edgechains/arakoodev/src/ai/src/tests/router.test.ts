import { describe, it, expect, vi, beforeEach } from "vitest";
import { SmartRouter } from "../lib/router/router";
import { OpenAI } from "../lib/openai/openai";
import { GeminiAI } from "../lib/gemini/gemini";

// Mock the providers
vi.mock("../lib/openai/openai");
vi.mock("../lib/gemini/gemini");

describe("SmartRouter", () => {
  let openAI: OpenAI;
  let gemini: GeminiAI;

  beforeEach(() => {
    vi.clearAllMocks();
    openAI = new OpenAI({ apiKey: "test" });
    gemini = new GeminiAI({ apiKey: "test" });
  });

  it("should route to the first provider if it succeeds", async () => {
    (openAI.chat as any).mockResolvedValueOnce({
      content: "OpenAI response",
    });

    const router = new SmartRouter([
      { instance: openAI, label: "openai" },
      { instance: gemini, label: "gemini" },
    ]);

    const response = await router.chat({ prompt: "hello" });

    expect(response.content).toBe("OpenAI response");
    expect(response.provider).toBe("openai");
    expect(gemini.chat).not.toHaveBeenCalled();
  });

  it("should failover to the second provider if the first fails", async () => {
    (openAI.chat as any).mockRejectedValueOnce(new Error("OpenAI failed"));
    (gemini.chat as any).mockResolvedValueOnce({
      candidates: [{ content: { parts: [{ text: "Gemini response" }] } }],
    });

    const router = new SmartRouter([
      { instance: openAI, label: "openai" },
      { instance: gemini, label: "gemini" },
    ]);

    const response = await router.chat({ prompt: "hello" });

    expect(response.content).toBe("Gemini response");
    expect(response.provider).toBe("gemini");
    expect(openAI.chat).toHaveBeenCalled();
    expect(gemini.chat).toHaveBeenCalled();
  });

  it("should throw error if all providers fail", async () => {
    (openAI.chat as any).mockRejectedValueOnce(new Error("OpenAI failed"));
    (gemini.chat as any).mockRejectedValueOnce(new Error("Gemini failed"));

    const router = new SmartRouter([
      { instance: openAI, label: "openai" },
      { instance: gemini, label: "gemini" },
    ]);

    await expect(router.chat({ prompt: "hello" })).rejects.toThrow(
      "All providers failed. Last error: Gemini failed"
    );
  });
});
