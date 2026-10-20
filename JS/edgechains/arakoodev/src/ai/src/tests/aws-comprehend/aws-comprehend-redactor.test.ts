import { describe, expect, test, vi } from "vitest";
import {
  AWSComprehendRedactor,
  AWSComprehendSdkAdapter,
  ComprehendPiiClient,
} from "../../lib/aws-comprehend/aws-comprehend-redactor";

const createClient = (): ComprehendPiiClient => ({
  detectPiiEntities: vi.fn(async ({ Text }) => {
    const email = "a@example.test";
    const phone = "+1-555-0100";

    return {
      Entities: [
        {
          Type: "EMAIL",
          Score: 0.99,
          BeginOffset: Text.indexOf(email),
          EndOffset: Text.indexOf(email) + email.length,
        },
        {
          Type: "PHONE",
          Score: 0.94,
          BeginOffset: Text.indexOf(phone),
          EndOffset: Text.indexOf(phone) + phone.length,
        },
      ].filter((entity) => entity.BeginOffset >= 0),
    };
  }),
});

describe("AWSComprehendRedactor", () => {
  test("redacts detected PII without shifting later offsets", async () => {
    const redactor = new AWSComprehendRedactor({ client: createClient() });
    const result = await redactor.redact(
      "Contact Alice: a@example.test or +1-555-0100.",
    );

    expect(result.text).toBe("Contact Alice: [EMAIL] or [PHONE].");
    expect(result.entities.map((entity) => entity.Type)).toEqual([
      "EMAIL",
      "PHONE",
    ]);
  });

  test("filters entities by score and type", async () => {
    const redactor = new AWSComprehendRedactor({
      client: createClient(),
      entityTypes: ["EMAIL"],
      minScore: 0.98,
    });

    const result = await redactor.redact(
      "Contact Alice: a@example.test or +1-555-0100.",
    );

    expect(result.text).toBe("Contact Alice: [EMAIL] or +1-555-0100.");
    expect(result.entities).toHaveLength(1);
  });

  test("redacts prompt and message content before chaining to chat endpoints", async () => {
    const redactor = new AWSComprehendRedactor({
      client: createClient(),
      replacement: "[REDACTED]",
    });
    const endpoint = {
      chat: vi.fn(async (options) => options),
    };

    const response = await redactor.chainChat(endpoint, {
      prompt: "Contact Alice: a@example.test or +1-555-0100.",
      messages: [
        {
          role: "user",
          content: "Contact Alice: a@example.test or +1-555-0100.",
        },
        {
          role: "assistant",
          content: undefined,
        },
      ],
      temperature: 0,
    });

    expect(endpoint.chat).toHaveBeenCalledOnce();
    expect(response.prompt).toBe("Contact Alice: [REDACTED] or [REDACTED].");
    expect(response.messages?.[0].content).toBe(
      "Contact Alice: [REDACTED] or [REDACTED].",
    );
    expect(response.temperature).toBe(0);
  });

  test("wraps an AWS SDK v3 client without adding a hard package dependency", async () => {
    class DetectPiiEntitiesCommand {
      constructor(public readonly input: unknown) {}
    }

    const sdkClient = {
      send: vi.fn(async (command) => ({
        Entities: [
          {
            Type: "NAME",
            BeginOffset: 0,
            EndOffset: 5,
          },
        ],
        command,
      })),
    };

    const adapter = new AWSComprehendSdkAdapter(
      sdkClient,
      DetectPiiEntitiesCommand,
    );
    const output = await adapter.detectPiiEntities({
      Text: "Alice",
      LanguageCode: "en",
    });

    expect(output.Entities?.[0].Type).toBe("NAME");
    expect(sdkClient.send).toHaveBeenCalledWith(
      expect.any(DetectPiiEntitiesCommand),
    );
  });
});
