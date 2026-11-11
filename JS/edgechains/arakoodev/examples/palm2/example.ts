import path from 'path';
import { Palm2Endpoint, loadPromptFromJsonnetFile } from '../../src/ai/src/lib/palm2/palm2';

export async function runPalm2Example() {
    const jsonnetPath = path.join(__dirname, 'prompt.jsonnet');
    const prompt = loadPromptFromJsonnetFile(jsonnetPath, 'prompt');
    const palm2 = new Palm2Endpoint({ apiKey: process.env.PALM_API_KEY });
    return palm2.generateText({
        prompt,
        temperature: 0.3,
        maxOutputTokens: 256,
    });
}
