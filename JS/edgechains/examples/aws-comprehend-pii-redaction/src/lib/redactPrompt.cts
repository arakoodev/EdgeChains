const { AWSComprehendPIIRedactor } = require("@arakoodev/edgechains.js/ai");

type RedactPromptRequest = {
  prompt: string;
  languageCode?: string;
  replacement?: string;
  awsRegion?: string;
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  mockMode?: boolean;
};

async function redactPrompt({
  prompt,
  languageCode,
  replacement,
  awsRegion,
  awsAccessKeyId,
  awsSecretAccessKey,
  mockMode,
}: RedactPromptRequest): Promise<string> {
  const redactor = new AWSComprehendPIIRedactor({
    region: awsRegion,
    accessKeyId: mockMode ? "mock-access-key" : awsAccessKeyId,
    secretAccessKey: mockMode ? "mock-secret-key" : awsSecretAccessKey,
    languageCode,
    replacement,
    fetch: mockMode ? createMockComprehendFetch(prompt) : undefined,
  });
  return redactor.redactText(prompt);
}

function createMockComprehendFetch(prompt: string) {
  return async () => {
    const entities = [
      createEntity(prompt, "Rahul", "NAME"),
      createEntity(prompt, "rahul@example.com", "EMAIL"),
      createEntity(prompt, "1234", "BANK_ACCOUNT_NUMBER"),
    ].filter(Boolean);

    return {
      ok: true,
      status: 200,
      json: async () => ({ Entities: entities }),
      text: async () => JSON.stringify({ Entities: entities }),
    } as Response;
  };
}

function createEntity(prompt: string, value: string, type: string) {
  const start = prompt.indexOf(value);
  if (start === -1) {
    return null;
  }

  return {
    Score: 0.99,
    Type: type,
    BeginOffset: start,
    EndOffset: start + value.length,
  };
}

module.exports = redactPrompt;
