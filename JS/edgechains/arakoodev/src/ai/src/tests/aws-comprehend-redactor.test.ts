import { AwsComprehendRedactor } from "../lib/aws-comprehend/comprehend-redactor";
import { describe, expect, it, vi } from "vitest";

describe("AwsComprehendRedactor", () => {
  it("redacts detected entities from the end of the string first", () => {
    const redactor = new AwsComprehendRedactor({
      accessKeyId: "access-key",
      secretAccessKey: "secret-key",
    });

    const redacted = redactor.redactDetectedEntities(
      "Email jane@example.com or call 555-0100",
      [
        {
          Type: "EMAIL",
          Score: 0.99,
          BeginOffset: 6,
          EndOffset: 22,
        },
        {
          Type: "PHONE",
          Score: 0.99,
          BeginOffset: 31,
          EndOffset: 39,
        },
      ],
    );

    expect(redacted).toBe("Email [REDACTED_EMAIL] or call [REDACTED_PHONE]");
  });

  it("filters entities by score and type", () => {
    const redactor = new AwsComprehendRedactor({
      accessKeyId: "access-key",
      secretAccessKey: "secret-key",
      minScore: 0.9,
      entityTypes: ["EMAIL"],
      replacement: "[PRIVATE]",
    });

    const redacted = redactor.redactDetectedEntities("Jane jane@example.com", [
      {
        Type: "NAME",
        Score: 0.99,
        BeginOffset: 0,
        EndOffset: 4,
      },
      {
        Type: "EMAIL",
        Score: 0.89,
        BeginOffset: 5,
        EndOffset: 21,
      },
    ]);

    expect(redacted).toBe("Jane jane@example.com");
  });

  it("redacts messages and chains into endpoint calls", async () => {
    const redactor = new AwsComprehendRedactor({
      accessKeyId: "access-key",
      secretAccessKey: "secret-key",
    });
    vi.spyOn(redactor, "detectPiiEntities").mockResolvedValue([
      {
        Type: "EMAIL",
        Score: 0.99,
        BeginOffset: 8,
        EndOffset: 24,
      },
    ]);
    const endpointCall = vi.fn().mockResolvedValue({ content: "ok" });

    const response = await redactor.redactEndpointPrompt(endpointCall, {
      prompt: "Contact jane@example.com",
    });

    expect(response).toEqual({ content: "ok" });
    expect(endpointCall).toHaveBeenCalledWith({
      prompt: "Contact [REDACTED_EMAIL]",
    });
  });

  it("calls AWS Comprehend DetectPiiEntities with signed headers", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        Entities: [
          {
            Type: "EMAIL",
            Score: 0.99,
            BeginOffset: 0,
            EndOffset: 16,
          },
        ],
      }),
    });
    const redactor = new AwsComprehendRedactor({
      accessKeyId: "access-key",
      secretAccessKey: "secret-key",
      region: "us-west-2",
      fetchFn,
    });

    const entities = await redactor.detectPiiEntities({
      text: "jane@example.com",
    });

    expect(entities).toHaveLength(1);
    expect(fetchFn).toHaveBeenCalledWith(
      "https://comprehend.us-west-2.amazonaws.com/",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "content-type": "application/x-amz-json-1.1",
          "x-amz-target": "Comprehend_20171127.DetectPiiEntities",
          Authorization: expect.stringContaining("AWS4-HMAC-SHA256"),
        }),
        body: JSON.stringify({
          Text: "jane@example.com",
          LanguageCode: "en",
        }),
      }),
    );
  });
});
