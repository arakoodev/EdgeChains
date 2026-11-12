import { describe, expect, it, vi } from "vitest";
import {
  ComprehendRedactor,
  withPIIRedaction,
} from "../lib/comprehend/redactor";

const makeFetch = (
  entities: any[],
  capture?: { url?: string; headers?: any; body?: string },
) => {
  return vi.fn(async (url: string, init?: any) => {
    if (capture) {
      capture.url = url;
      capture.headers = init?.headers;
      capture.body = init?.body;
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ Entities: entities }),
      text: async () => JSON.stringify({ Entities: entities }),
    } as any;
  });
};

const baseOptions = {
  region: "us-east-1",
  credentials: { accessKeyId: "AKIDEXAMPLE", secretAccessKey: "secret" },
};

describe("ComprehendRedactor", () => {
  it("throws a helpful error when credentials are missing", async () => {
    const original = { ...process.env };
    delete process.env.AWS_REGION;
    delete process.env.AWS_DEFAULT_REGION;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;

    const redactor = new ComprehendRedactor();
    await expect(redactor.redact("hello")).rejects.toThrow(
      /credentials are missing/i,
    );

    process.env.AWS_REGION = original.AWS_REGION;
    process.env.AWS_DEFAULT_REGION = original.AWS_DEFAULT_REGION;
    process.env.AWS_ACCESS_KEY_ID = original.AWS_ACCESS_KEY_ID;
    process.env.AWS_SECRET_ACCESS_KEY = original.AWS_SECRET_ACCESS_KEY;
  });

  it("sends a signed DetectPiiEntities request and parses entities", async () => {
    const capture: any = {};
    const fetchImpl = makeFetch(
      [{ Score: 0.99, Type: "NAME", BeginOffset: 7, EndOffset: 11 }],
      capture,
    );
    const redactor = new ComprehendRedactor({ ...baseOptions, fetchImpl });

    const entities = await redactor.detect("meet John tomorrow");

    expect(entities).toEqual([
      { type: "NAME", beginOffset: 7, endOffset: 11, score: 0.99 },
    ]);
    expect(capture.url).toBe("https://comprehend.us-east-1.amazonaws.com/");
    expect(capture.headers["X-Amz-Target"]).toBe(
      "Comprehend_20171127.DetectPiiEntities",
    );
    expect(capture.headers.Authorization).toMatch(
      /^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\//,
    );
    expect(JSON.parse(capture.body)).toEqual({
      Text: "meet John tomorrow",
      LanguageCode: "en",
    });
  });

  it("masks PII spans with placeholders by default", async () => {
    const text = "contact john@example.com now";
    const fetchImpl = makeFetch([
      { Score: 1, Type: "EMAIL", BeginOffset: 8, EndOffset: 24 },
    ]);
    const redactor = new ComprehendRedactor({ ...baseOptions, fetchImpl });

    const result = await redactor.redact(text);

    expect(result.redactedText).toBe("contact [EMAIL] now");
    expect(result.entities).toHaveLength(1);
  });

  it("supports asterisk masking that preserves length", async () => {
    const text = "card 4111111111111111 please";
    const spanStart = text.indexOf("4111");
    const fetchImpl = makeFetch([
      {
        Score: 0.98,
        Type: "CREDIT_DEBIT_NUMBER",
        BeginOffset: spanStart,
        EndOffset: spanStart + 16,
      },
    ]);
    const redactor = new ComprehendRedactor({
      ...baseOptions,
      maskStyle: "asterisk",
      fetchImpl,
    });

    const result = await redactor.redact(text);

    expect(result.redactedText).toBe(`card ${"*".repeat(16)} please`);
    expect(result.redactedText.length).toBe(text.length);
  });

  it("handles multiple unsorted entities without corrupting offsets", async () => {
    const text = "John lives at 10 Downing St";
    const nameStart = text.indexOf("John");
    const streetStart = text.indexOf("10 Downing");
    const fetchImpl = makeFetch([
      {
        Score: 0.9,
        Type: "ADDRESS",
        BeginOffset: streetStart,
        EndOffset: streetStart + 10,
      },
      {
        Score: 0.95,
        Type: "NAME",
        BeginOffset: nameStart,
        EndOffset: nameStart + 4,
      },
    ]);
    const redactor = new ComprehendRedactor({ ...baseOptions, fetchImpl });

    const result = await redactor.redact(text);

    expect(result.redactedText).toBe("[NAME] lives at [ADDRESS] St");
  });

  it("propagates API failures as descriptive errors", async () => {
    const fetchImpl = vi.fn(
      async () =>
        ({
          ok: false,
          status: 403,
          text: async () => "AccessDeniedException",
          json: async () => ({}),
        }) as any,
    );
    const redactor = new ComprehendRedactor({ ...baseOptions, fetchImpl });

    await expect(redactor.redact("secret")).rejects.toThrow(
      /403.*AccessDeniedException/s,
    );
  });
});

describe("withPIIRedaction", () => {
  it("redacts the prompt before it reaches the chained client", async () => {
    const chatSpy = vi.fn(async (options: any) => ({
      content: `echo:${options.prompt}`,
    }));
    const fakeClient = { chat: chatSpy, someOtherMethod: () => "untouched" };

    const text = "email me at jane@corp.org";
    const emailStart = text.indexOf("jane@corp.org");
    const fetchImpl = makeFetch([
      {
        Score: 1,
        Type: "EMAIL",
        BeginOffset: emailStart,
        EndOffset: text.length,
      },
    ]);
    const redactor = new ComprehendRedactor({ ...baseOptions, fetchImpl });

    const chained = withPIIRedaction(fakeClient as any, redactor);
    const response = await chained.chat({
      prompt: text,
      model: "gpt-3.5-turbo",
    });

    expect(chatSpy).toHaveBeenCalledTimes(1);
    expect(chatSpy.mock.calls[0][0].prompt).toBe("email me at [EMAIL]");
    // all other options are forwarded untouched
    expect(chatSpy.mock.calls[0][0].model).toBe("gpt-3.5-turbo");
    expect(response.content).toBe("echo:email me at [EMAIL]");
    // non-chat members still work through the proxy
    expect((chained as any).someOtherMethod()).toBe("untouched");
  });

  it("passes non-string prompts through without redaction", async () => {
    const chatSpy = vi.fn(async (options: any) => ({ ok: true }));
    const fetchImpl = makeFetch([]);
    const redactor = new ComprehendRedactor({ ...baseOptions, fetchImpl });

    const chained = withPIIRedaction({ chat: chatSpy } as any, redactor);
    const messages = [{ role: "user", content: "keep raw" }];
    await chained.chat({ messages });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(chatSpy.mock.calls[0][0].messages).toBe(messages);
  });
});
