import fs from 'fs';
import path from 'path';

describe('Prompts JSON Tests', () => {
  let promptsData: any;

  beforeAll(() => {
    const filePath = path.join(__dirname, 'prompts.jsonnet');
    const fileContents = fs.readFileSync(filePath, 'utf-8');
    promptsData = JSON.parse(fileContents);
  });

  test('Text Prompts Exist', () => {
    expect(promptsData).toHaveProperty('textPrompts');
    expect(Array.isArray(promptsData.textPrompts)).toBe(true);
    expect(promptsData.textPrompts.length).toBeGreaterThan(0);
  });

  test('Message Prompts Exist', () => {
    expect(promptsData).toHaveProperty('messagePrompts');
    expect(Array.isArray(promptsData.messagePrompts)).toBe(true);
    expect(promptsData.messagePrompts.length).toBeGreaterThan(0);
  });

  test('Text Prompts JSON Structure', () => {
    const { textPrompts } = promptsData;
    textPrompts.forEach((prompt: any) => {
      expect(prompt).toHaveProperty('model');
      expect(prompt).toHaveProperty('prompt');
      expect(prompt).toHaveProperty('temperature');
      expect(prompt).toHaveProperty('candidate_count');
      expect(prompt).toHaveProperty('expectedResponses');
    });
  });

  test('Message Prompts JSON Structure', () => {
    const { messagePrompts } = promptsData;
    messagePrompts.forEach((prompt: any) => {
      expect(prompt).toHaveProperty('model');
      expect(prompt).toHaveProperty('prompt');
      expect(prompt).toHaveProperty('expectedResponse');
    });
  });
});
