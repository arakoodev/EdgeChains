const { setTimeout } = require("timers/promises");
const palm2Prompts = require("./palm2Prompts.json");
const Palm2ChatFn = require("../../lib/src/lib/endpoints/Palm2AiEndpoint")


it('should return a string when called with valid parameters', async () => {
    // Arrange
    const prompt = palm2Prompts["Pm_of_india"];
    const apiKey = "AIzaSyB2Cc5yX0q5HCOgMWtdsh5mALBorAiLlxE";
    const temperature = 0.1;

    // Mock the fetch function
    global.fetch = jest.fn().mockResolvedValue({
        json: jest.fn().mockResolvedValue({
            candidates: [{ content: "Response" }]
        })
    });

    const result = await Palm2ChatFn(prompt, apiKey, temperature);

    expect(typeof result).toBe("string");
});
it('should return a string when called with valid parameters', async () => {
    // Arrange
    const prompt = palm2Prompts["states_in_India"];
    const apiKey = "AIzaSyB2Cc5yX0q5HCOgMWtdsh5mALBorAiLlxE";
    const temperature = 0.1;

    global.fetch = jest.fn().mockResolvedValue({
        json: jest.fn().mockResolvedValue({
            candidates: [{ content: "Response" }]
        })
    });

    const result = await Palm2ChatFn(prompt, apiKey, temperature);

    expect(typeof result).toBe("string");
});

it('should return a string when called with valid parameters', async () => {
    const prompt = palm2Prompts["smallest_2_digit_value"];
    const apiKey = "AIzaSyB2Cc5yX0q5HCOgMWtdsh5mALBorAiLlxE";
    const temperature = 0.1;

    global.fetch = jest.fn().mockResolvedValue({
        json: jest.fn().mockResolvedValue({
            candidates: [{ content: "Response" }]
        })
    });

    const result = await Palm2ChatFn(prompt, apiKey, temperature);

    expect(typeof result).toBe("string");
});
