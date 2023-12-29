import { Jsonnet } from '@hanazuki/node-jsonnet';
import * as path from 'path';
import { GeminiAPI } from '../GeminiEndoints';

const jsonnet = new Jsonnet();

export async function loadPrompt(promptPath: string): Promise<string>{
  try {
    const prompt = await jsonnet.evaluateFile(promptPath);
    return prompt;
  } catch (error: any) {
    throw new Error(`Error loading prompt: ${error.message}`);
  }
}

const gemini = new GeminiAPI(
  'API_KEY',
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro'
);

const promptPath = path.join(__dirname, 'prompts.jsonnet');

(async () => {
  try {
    const prompt = await loadPrompt(promptPath);
    const generatedContent = await gemini.generateContent(prompt);
    console.log('Generated Content:', generatedContent);
  } catch (error) {
    console.error('Error:', error);
  }
})();
