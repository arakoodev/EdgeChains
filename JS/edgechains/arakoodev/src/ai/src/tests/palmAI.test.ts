import axios from "axios";
import { PalmAI } from "../lib/palm/palm";

jest.mock("axios");

describe("PalmAI", () => {
    describe("chat", () => {
        test("should generate response from Palm 2 API", async () => {
            const mockResponse = {
                data: {
                    candidates: [
                        {
                            output: "Hello! I am PaLM 2.",
                            safetyRatings: [
                                {
                                    category: "HARM_CATEGORY_TOXIC",
                                    probability: "NEGLIGIBLE",
                                },
                            ],
                        },
                    ],
                },
            };

            (axios.request as jest.Mock).mockResolvedValueOnce(mockResponse);

            const palm = new PalmAI({ apiKey: "test-palm-key" });
            const response = await palm.chat({ prompt: "hello", model: "text-bison-001" });

            expect(response.candidates[0].output).toBe("Hello! I am PaLM 2.");
            expect(axios.request).toHaveBeenCalledWith(
                expect.objectContaining({
                    method: "post",
                    url: "https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generateText?key=test-palm-key",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    data: JSON.stringify({
                        prompt: {
                            text: "hello",
                        },
                    }),
                })
            );
        });
    });
});
