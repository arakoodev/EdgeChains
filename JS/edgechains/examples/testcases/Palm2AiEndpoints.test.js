import { Palm2AiEndpoint } from "../../lib/src/lib/endpoints/Palm2AiEndpoint";

describe('Palm2AiEndpoint', () => {
    test('should return the expected response for a given prompt', async () => {
        const apiKey = 'AIzaSyB2Cc5yX0q5HCOgMWtdsh5mALBorAiLlxE';
        const model = 'models/text-bison-001';
        const temperature = 0.7;

        const palm2AiEndpoint = new Palm2AiEndpoint(apiKey, model, temperature);

        // const response = await palm2AiEndpoint.chatFun(promptText)
        expect(await palm2AiEndpoint.chatFun("how many states in Inida")).toBe('28');
    });
});
describe('Palm2AiEndpoint', () => {
    test('should return the expected response for a given prompt', async () => {
        const apiKey = 'AIzaSyB2Cc5yX0q5HCOgMWtdsh5mALBorAiLlxE';
        const model = 'models/text-bison-001';
        const temperature = 0.7;

        const palm2AiEndpoint = new Palm2AiEndpoint(apiKey, model, temperature);

        // const response = await palm2AiEndpoint.chatFun(promptText)
        expect(await palm2AiEndpoint.chatFun("Pm of india")).toBe('NarendraModi');
    });
});

describe('Palm2AiEndpoint', () => {
    test('should return the expected response for a given prompt', async () => {
        const apiKey = 'AIzaSyB2Cc5yX0q5HCOgMWtdsh5mALBorAiLlxE';
        const model = 'models/text-bison-001';
        const temperature = 0.7;

        const palm2AiEndpoint = new Palm2AiEndpoint(apiKey, model, temperature);

        // const response = await palm2AiEndpoint.chatFun(promptText)
        expect(await palm2AiEndpoint.chatFun("smallest 2 digit value")).toBe('10');
    });
});
