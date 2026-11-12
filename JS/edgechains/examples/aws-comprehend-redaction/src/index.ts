import {
  AWSComprehendRedactor,
  ComprehendPiiClient,
} from "@arakoodev/edgechains.js/ai";

const mockComprehendClient: ComprehendPiiClient = {
  async detectPiiEntities({ Text }) {
    return {
      Entities: [
        {
          Type: "EMAIL",
          Score: 0.99,
          BeginOffset: Text.indexOf("alice@example.test"),
          EndOffset:
            Text.indexOf("alice@example.test") + "alice@example.test".length,
        },
        {
          Type: "PHONE",
          Score: 0.98,
          BeginOffset: Text.indexOf("+1-555-0100"),
          EndOffset: Text.indexOf("+1-555-0100") + "+1-555-0100".length,
        },
      ].filter((entity) => entity.BeginOffset >= 0),
    };
  },
};

const endpoint = {
  async chat({ prompt }: { prompt: string }) {
    return {
      content: `Endpoint received: ${prompt}`,
    };
  },
};

const redactor = new AWSComprehendRedactor({
  client: mockComprehendClient,
  minScore: 0.9,
});

const prompt = "Please email Alice at alice@example.test or call +1-555-0100.";
const redactedPrompt = await redactor.redact(prompt);
const response = await redactor.chainChat(endpoint, { prompt });

console.log("Original prompt:", prompt);
console.log("Redacted prompt:", redactedPrompt.text);
console.log("Endpoint response:", response.content);
