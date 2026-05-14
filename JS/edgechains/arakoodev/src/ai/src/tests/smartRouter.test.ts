import { SmartRouter, DeploymentConfig } from "../lib/router/smart-router";
import axios from "axios";
import { Readable } from "stream";
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("axios");
const mockedAxios = axios as ReturnType<typeof vi.fn>;

describe("SmartRouter Extended Features", () => {
    const createMockAxiosInstance = (postMock: any) => ({
        post: postMock,
        interceptors: {
            request: { use: vi.fn(), eject: vi.fn(), clear: vi.fn() },
            response: { use: vi.fn(), eject: vi.fn(), clear: vi.fn() }
        }
    });

    it("should support streaming", async () => {
        const deployment: DeploymentConfig = { id: "oa1", provider: "openai", model: "gpt-3.5-turbo", apiKey: "sk-1" };
        const mockStream = new Readable();
        mockStream.push("chunk 1");
        mockStream.push(null);

        const postMock = vi.fn().mockResolvedValue({ data: mockStream });
        mockedAxios.create.mockReturnValue(createMockAxiosInstance(postMock));

        const router = new SmartRouter({ deployments: [deployment] });
        const stream = await router.chat({ messages: [{ role: "user", content: "hi" }], stream: true });

        expect(stream).toBeInstanceOf(Readable);
        expect(postMock).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ stream: true }),
            expect.objectContaining({ responseType: "stream" })
        );
    });

    it("should handle 429 rate limits", async () => {
        const deployments: DeploymentConfig[] = [
            { id: "oa1", provider: "openai", model: "gpt-3.5-turbo", apiKey: "sk-1" },
            { id: "oa2", provider: "openai", model: "gpt-3.5-turbo", apiKey: "sk-2" }
        ];

        const error429 = {
            response: { status: 429 },
            message: "Rate limit exceeded"
        };
        const successResponse = {
            data: {
                choices: [{ message: { content: "Success after failover" } }],
                usage: { total_tokens: 10 }
            }
        };

        const postMock = vi.fn()
            .mockRejectedValueOnce(error429)
            .mockResolvedValueOnce(successResponse);

        mockedAxios.create.mockReturnValue(createMockAxiosInstance(postMock));

        const router = new SmartRouter({ deployments });
        const res = await router.chat({ messages: [{ role: "user", content: "hi" }] }) as any;

        expect(res.content).toBe("Success after failover");
        expect(postMock).toHaveBeenCalledTimes(2);
    });

    it("should implement round-robin strategy", async () => {
        const deployments: DeploymentConfig[] = [
            { id: "d1", provider: "openai", model: "gpt-3.5-turbo", apiKey: "sk-1" },
            { id: "d2", provider: "openai", model: "gpt-3.5-turbo", apiKey: "sk-2" },
            { id: "d3", provider: "openai", model: "gpt-3.5-turbo", apiKey: "sk-3" }
        ];

        const postMock = vi.fn().mockResolvedValue({
            data: {
                choices: [{ message: { content: "test" } }],
                usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
            }
        });
        mockedAxios.create.mockReturnValue(createMockAxiosInstance(postMock));

        const router = new SmartRouter({ deployments, strategy: "round-robin" });

        const results: string[] = [];
        for (let i = 0; i < 3; i++) {
            const res = await router.chat({ messages: [{ role: "user", content: "hi" }] }) as any;
            results.push(res.provider);
        }

        expect(results[0]).toBe("openai");
        expect(results[1]).toBe("openai");
        expect(results[2]).toBe("openai");
    });

    it("should implement priority strategy", async () => {
        const deployments: DeploymentConfig[] = [
            { id: "d1", provider: "openai", model: "gpt-3.5-turbo", apiKey: "sk-1", priority: 2 },
            { id: "d2", provider: "openai", model: "gpt-4", apiKey: "sk-2", priority: 1 },
            { id: "d3", provider: "openai", model: "gpt-3.5-turbo", apiKey: "sk-3", priority: 3 }
        ];

        const postMock = vi.fn().mockResolvedValue({
            data: {
                choices: [{ message: { content: "test" } }],
                usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
            }
        });
        mockedAxios.create.mockReturnValue(createMockAxiosInstance(postMock));

        const router = new SmartRouter({ deployments, strategy: "priority" });
        const res = await router.chat({ messages: [{ role: "user", content: "hi" }] }) as any;

        expect(res.model).toBe("gpt-4");
    });
});
