import { describe, expect, it, vi } from "vitest";
import {
  AWSComprehendPIIRedactor,
  ComprehendRedactionMiddleware,
} from "../../lib/aws-comprehend/aws-comprehend";

const mockDate = new Date("2026-05-13T08:30:00.000Z");

function createJsonResponse(body: object): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe("AWSComprehendPIIRedactor", () => {
  it("calls AWS Comprehend DetectPiiEntities with signed REST headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        Entities: [
          {
            Score: 0.99,
            Type: "EMAIL",
            BeginOffset: 14,
            EndOffset: 30,
          },
        ],
      }),
    );
    const redactor = new AWSComprehendPIIRedactor({
      region: "us-east-1",
      accessKeyId: "AKIA_TEST",
      secretAccessKey: "secret",
      endpoint: "https://comprehend.us-east-1.amazonaws.com",
      fetch: fetchMock,
      now: () => mockDate,
    });

    const response = await redactor.detectPiiEntities(
      "Email Rahul at rahul@example.com",
    );

    expect(response.Entities).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://comprehend.us-east-1.amazonaws.com");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      "content-type": "application/x-amz-json-1.1",
      "x-amz-date": "20260513T083000Z",
      "x-amz-target": "Comprehend_20171127.DetectPiiEntities",
    });
    expect(String(init.headers.Authorization)).toContain("AWS4-HMAC-SHA256");
    expect(init.body).toBe(
      JSON.stringify({
        Text: "Email Rahul at rahul@example.com",
        LanguageCode: "en",
      }),
    );
  });

  it("redacts matching PII entities with type-specific placeholders", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        Entities: [
          {
            Score: 0.99,
            Type: "NAME",
            BeginOffset: 6,
            EndOffset: 11,
          },
          {
            Score: 0.98,
            Type: "EMAIL",
            BeginOffset: 15,
            EndOffset: 32,
          },
        ],
      }),
    );
    const redactor = new AWSComprehendPIIRedactor({
      accessKeyId: "AKIA_TEST",
      secretAccessKey: "secret",
      fetch: fetchMock,
      now: () => mockDate,
    });

    await expect(
      redactor.redactText("Email Rahul at rahul@example.com"),
    ).resolves.toBe("Email [REDACTED_NAME] at [REDACTED_EMAIL]");
  });

  it("supports redacting prompt options before calling an endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        Entities: [
          {
            Score: 0.99,
            Type: "PHONE",
            BeginOffset: 8,
            EndOffset: 20,
          },
        ],
      }),
    );
    const endpoint = {
      chat: vi.fn().mockResolvedValue({ content: "ok" }),
    };
    const redactor = new AWSComprehendPIIRedactor({
      accessKeyId: "AKIA_TEST",
      secretAccessKey: "secret",
      fetch: fetchMock,
      now: () => mockDate,
    });
    const middleware = new ComprehendRedactionMiddleware(redactor);
    const wrappedEndpoint = middleware.wrapEndpoint(endpoint);

    await wrappedEndpoint.chat({ prompt: "Call me 555-867-5309" });

    expect(endpoint.chat).toHaveBeenCalledWith({
      prompt: "Call me [REDACTED_PHONE]",
    });
  });

  it("supports observable-like prompt redaction", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        Entities: [
          {
            Score: 0.99,
            Type: "EMAIL",
            BeginOffset: 15,
            EndOffset: 32,
          },
        ],
      }),
    );
    const redactor = new AWSComprehendPIIRedactor({
      accessKeyId: "AKIA_TEST",
      secretAccessKey: "secret",
      fetch: fetchMock,
      now: () => mockDate,
    });
    const source = {
      subscribe: (observer: {
        next: (value: string) => void;
        complete?: () => void;
      }) => {
        observer.next("Email Rahul at rahul@example.com");
        observer.complete?.();
      },
    };
    const values: string[] = [];

    await new Promise<void>((resolve, reject) => {
      redactor.redactObservable(source).subscribe({
        next: (value) => values.push(value),
        error: reject,
        complete: resolve,
      });
    });

    expect(values).toEqual(["Email Rahul at [REDACTED_EMAIL]"]);
  });
});
