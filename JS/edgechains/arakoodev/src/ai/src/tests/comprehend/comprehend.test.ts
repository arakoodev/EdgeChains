import { describe, expect, it, vi } from "vitest";
import {
  AWSComprehendClient,
  AWSComprehendRedactor,
  type ComprehendClient,
  type ComprehendPiiEntity,
} from "../../lib/comprehend/comprehend.js";

const entities: ComprehendPiiEntity[] = [
  { Type: "EMAIL", Score: 0.99, BeginOffset: 14, EndOffset: 28 },
  { Type: "PHONE", Score: 0.93, BeginOffset: 32, EndOffset: 44 },
];

function mockClient(returnedEntities = entities): ComprehendClient {
  return {
    detectPiiEntities: vi.fn(async () => ({ Entities: returnedEntities })),
  };
}

describe("AWSComprehendRedactor", () => {
  it("redacts detected PII with typed placeholders", async () => {
    const redactor = new AWSComprehendRedactor({ client: mockClient() });

    const result = await redactor.redact(
      "Contact Jane: jane@site.test or 555-123-4567",
    );

    expect(result.text).toBe(
      "Contact Jane: [REDACTED_EMAIL] or [REDACTED_PHONE]",
    );
    expect(result.entities).toHaveLength(2);
  });

  it("filters by confidence and entity type", async () => {
    const redactor = new AWSComprehendRedactor({
      client: mockClient([
        { Type: "EMAIL", Score: 0.99, BeginOffset: 0, EndOffset: 14 },
        { Type: "PHONE", Score: 0.42, BeginOffset: 19, EndOffset: 31 },
        { Type: "NAME", Score: 0.98, BeginOffset: 36, EndOffset: 40 },
      ]),
      minScore: 0.9,
      entityTypes: ["EMAIL"],
    });

    const result = await redactor.redact(
      "jane@site.test and 555-123-4567 for Jane",
    );

    expect(result.text).toBe("[REDACTED_EMAIL] and 555-123-4567 for Jane");
    expect(result.entities.map((entity) => entity.Type)).toEqual(["EMAIL"]);
  });

  it("redacts prompts and messages without mutating the original options", async () => {
    const client = mockClient([
      { Type: "EMAIL", Score: 0.99, BeginOffset: 6, EndOffset: 20 },
    ]);
    const redactor = new AWSComprehendRedactor({ client });
    const options = {
      prompt: "Email jane@site.test before sending the summary.",
      messages: [{ role: "user", content: "Email jane@site.test" }],
      temperature: 0.2,
    };

    const result = await redactor.redactPromptOptions(options);

    expect(result.prompt).toBe(
      "Email [REDACTED_EMAIL] before sending the summary.",
    );
    expect(result.messages?.[0].content).toBe("Email [REDACTED_EMAIL]");
    expect(options.messages[0].content).toBe("Email jane@site.test");
  });

  it("wraps chat endpoints and forwards redacted options", async () => {
    const redactor = new AWSComprehendRedactor({
      client: mockClient([
        { Type: "EMAIL", Score: 0.99, BeginOffset: 6, EndOffset: 20 },
      ]),
    });
    const endpoint = {
      chat: vi.fn(async (options: { prompt: string }) => ({
        content: options.prompt,
      })),
    };

    const wrapped = redactor.wrapChat(endpoint);
    const response = await wrapped.chat({ prompt: "Email jane@site.test" });

    expect(endpoint.chat).toHaveBeenCalledWith({
      prompt: "Email [REDACTED_EMAIL]",
    });
    expect(response).toEqual({ content: "Email [REDACTED_EMAIL]" });
  });

  it("signs DetectPiiEntities requests for AWS Comprehend", async () => {
    const fetch = vi.fn(
      async (
        _url: string,
        init: { headers: Record<string, string>; body: string },
      ) => ({
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => "",
        json: async () => ({ Entities: [] }),
        init,
      }),
    );
    const client = new AWSComprehendClient({
      accessKeyId: "AKIA_TEST",
      secretAccessKey: "secret",
      region: "us-east-1",
      endpoint: "https://comprehend.us-east-1.amazonaws.com",
      now: () => new Date("2026-05-29T12:00:00.000Z"),
      fetch,
    });

    await client.detectPiiEntities({
      Text: "hello@example.com",
      LanguageCode: "en",
    });

    const [, init] = fetch.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({
      Text: "hello@example.com",
      LanguageCode: "en",
    });
    expect(init.headers["X-Amz-Target"]).toBe(
      "Comprehend_20171127.DetectPiiEntities",
    );
    expect(init.headers.Authorization).toContain(
      "AWS4-HMAC-SHA256 Credential=AKIA_TEST/20260529/us-east-1/comprehend/aws4_request",
    );
    expect(init.headers.Authorization).toContain(
      "SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date;x-amz-target",
    );
  });
});
