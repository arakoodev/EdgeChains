import { AWSComprehendPIIRedactor } from "../../../arakoodev/src/ai/src/lib/comprehend/comprehend.ts";

const prompt =
  "Summarize this customer note: Jane Doe, jane@example.com, called about billing.";

const redactor = new AWSComprehendPIIRedactor({
  client: {
    async detectPiiEntities({ Text }) {
      const name = "Jane Doe";
      const email = "jane@example.com";
      return {
        Entities: [
          {
            Type: "NAME",
            BeginOffset: Text.indexOf(name),
            EndOffset: Text.indexOf(name) + name.length,
            Score: 0.99,
          },
          {
            Type: "EMAIL",
            BeginOffset: Text.indexOf(email),
            EndOffset: Text.indexOf(email) + email.length,
            Score: 0.99,
          },
        ],
      };
    },
  },
});

const safeEndpoint = redactor.wrapChat({
  async chat({ prompt }: { prompt?: string }) {
    return {
      content: `Endpoint received: ${prompt}`,
    };
  },
});

const response = await safeEndpoint.chat({ prompt });

console.log(response.content);
