import axios from "axios";
import { Palm2AI } from "../../../../dist/ai/src/lib/palm2/palm2.js";

jest.mock("axios");

describe("Palm2AI", () => {
    describe("chat", () => {
        test("should generate response from Palm2", async () => {
            const mockResponse = {
                candidates: [
                    {
                        output: "Test response",
                        safetyRatings: [],
                    },
                ],
            };

            axios.request = jest.fn().mockResolvedValueOnce({ data: mockResponse });
            const palm2 = new Palm2AI({ apiKey: "test_api_key" });
            const response = await palm2.chat({ prompt: "test prompt" });
            expect(response.candidates[0].output).toEqual("Test response");
        });
    });
});
