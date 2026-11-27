import {
  AWSComprehendPiiClient,
  AWSComprehendPiiEntity,
  AWSComprehendRedactor,
} from "@arakoodev/edgechains.js/ai";

const prompt =
  "My name is Jane Doe. Email me at jane@example.com and call 555-0100 about invoice INV-42.";

const demoClient: AWSComprehendPiiClient = {
  async detectPiiEntities({ Text }) {
    return {
      Entities: [
        entityFor(Text, "Jane Doe", "NAME"),
        entityFor(Text, "jane@example.com", "EMAIL"),
        entityFor(Text, "555-0100", "PHONE"),
      ],
    };
  },
};

const chatEndpoint = {
  async chat({ prompt: redactedPrompt }: { prompt?: string }) {
    return {
      content: `Prompt received by endpoint: ${redactedPrompt}`,
    };
  },
};

const redactor = new AWSComprehendRedactor({ client: demoClient });
const redactedPrompt = await redactor.redact(prompt);
const protectedEndpoint = redactor.chainEndpoint(chatEndpoint);
const response = await protectedEndpoint.chat({ prompt });

console.log("Original prompt:");
console.log(prompt);
console.log("\nRedacted prompt:");
console.log(redactedPrompt);
console.log("\nEndpoint response:");
console.log(response.content);

const streamOutput: string[] = [];
for await (const chunk of redactor.redactStream([prompt])) {
  streamOutput.push(chunk);
}
console.log("\nStream output:");
console.log(streamOutput.join("\n"));

if (process.env.USE_LIVE_AWS_COMPREHEND === "true") {
  const liveRedactor = new AWSComprehendRedactor({
    region: process.env.AWS_REGION || "us-east-1",
  });
  console.log("\nLive AWS Comprehend redaction:");
  console.log(await liveRedactor.redact(prompt));
}

function entityFor(
  text: string,
  snippet: string,
  type: string,
): AWSComprehendPiiEntity {
  const start = text.indexOf(snippet);

  if (start < 0) {
    throw new Error(`Snippet not found: ${snippet}`);
  }

  const beginOffset = Array.from(text.slice(0, start)).length;
  const endOffset = beginOffset + Array.from(snippet).length;

  return {
    Type: type,
    Score: 0.99,
    BeginOffset: beginOffset,
    EndOffset: endOffset,
  };
}
