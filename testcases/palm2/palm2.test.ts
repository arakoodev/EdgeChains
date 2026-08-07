import { Palm2 } from '../../src/lib/endpoints/palm2/Palm2';

describe('Palm2', () => {
  let palm2: Palm2;

  beforeEach(() => {
    palm2 = new Palm2({
      apiKey: 'test-key',
      model: 'palm2',
      temperature: 0.7,
      maxTokens: 1024
    });
  });

  it('should initialize with config', () => {
    expect(palm2).toBeDefined();
  });

  it('should generate response from prompt', async () => {
    const response = await palm2.generate({ prompt: 'Hello' });
    expect(response.text).toBeDefined();
    expect(response.finishReason).toBeDefined();
  });

  it('should respect temperature parameter', async () => {
    const response = await palm2.generate({
      prompt: 'Test',
      temperature: 0.5
    });
    expect(response).toBeDefined();
  });

  it('should respect max tokens parameter', async () => {
    const response = await palm2.generate({
      prompt: 'Test',
      maxTokens: 512
    });
    expect(response).toBeDefined();
  });
});
