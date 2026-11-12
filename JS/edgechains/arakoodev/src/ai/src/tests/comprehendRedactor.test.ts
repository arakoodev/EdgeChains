import { afterEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
import { OpenAI } from "../lib/openai/openai.js";
import { firstValueFrom } from "rxjs";
import type {
  PiiEntity,
} from "@aws-sdk/client-comprehend";
import {
  AwsComprehendRedactor,
  type ChatOptionsLike,
  type ComprehendClientLike,
} from "../lib/comprehend/comprehendRedactor.js";

function fakeClient(entities: PiiEntity[]): ComprehendClientLike {
  return {
    send: vi.fn(async () => ({
      Entities: entities,
    })) as unknown as ComprehendClientLike["send"],
  };
}

describe("AwsComprehendRedactor", () => {
  it("redacts detected entities with their type by default", async () => {
    const redactor = new AwsComprehendRedactor({
      client: fakeClient([
        { BeginOffset: 6, EndOffset: 21, Score: 0.99, Type: "EMAIL" },
      ]),
    });

    await expect(redactor.redact("Email a@b.example.com now")).resolves.toBe(
      "Email [EMAIL] now",
    );
  });

  it("applies score and entity type filters", async () => {
    const redactor = new AwsComprehendRedactor({
      client: fakeClient([
        { BeginOffset: 0, EndOffset: 3, Score: 0.4, Type: "NAME" },
        { BeginOffset: 8, EndOffset: 12, Score: 0.99, Type: "NAME" },
        { BeginOffset: 17, EndOffset: 20, Score: 0.99, Type: "PIN" },
      ]),
      minScore: 0.9,
      entityTypes: ["NAME"],
      replacement: "redacted",
    });

    await expect(redactor.redact("Sam met Jane at 123")).resolves.toBe(
      "Sam met [REDACTED] at 123",
    );
  });

  it("uses Unicode code-point offsets instead of UTF-16 indexes", async () => {
    const redactor = new AwsComprehendRedactor({
      client: fakeClient([
        { BeginOffset: 5, EndOffset: 8, Score: 1, Type: "NAME" },
      ]),
    });

    await expect(redactor.redact("Hi 👋 Ana")).resolves.toBe("Hi 👋 [NAME]");
  });

  it("skips overlapping lower-offset spans deterministically", async () => {
    const redactor = new AwsComprehendRedactor({
      client: fakeClient([
        { BeginOffset: 0, EndOffset: 9, Score: 0.99, Type: "ADDRESS" },
        { BeginOffset: 5, EndOffset: 9, Score: 0.99, Type: "NAME" },
      ]),
    });

    await expect(redactor.redact("1234 Main St")).resolves.toBe(
      "1234 [NAME] St",
    );
  });

  it("redacts prompts and messages without mutating caller input", async () => {
    const client: ComprehendClientLike = {
      send: vi.fn(async () => ({
        Entities: [{ BeginOffset: 0, EndOffset: 4, Score: 1, Type: "NAME" }],
      })) as unknown as ComprehendClientLike["send"],
    };
    const redactor = new AwsComprehendRedactor({ client });
    const options: ChatOptionsLike = {
      prompt: "John prompt",
      messages: [{ role: "user", content: "Jane message" }],
    };

    const safe = await redactor.redactChatOptions(options);

    expect(safe.prompt).toBe("[NAME] prompt");
    expect(safe.messages?.[0].content).toBe("[NAME] message");
    expect(options.prompt).toBe("John prompt");
    expect(options.messages?.[0].content).toBe("Jane message");
  });

  it("chains redaction into an existing endpoint as an Observable", async () => {
    const redactor = new AwsComprehendRedactor({
      client: fakeClient([
        { BeginOffset: 0, EndOffset: 4, Score: 1, Type: "NAME" },
      ]),
    });
    const endpoint = {
      chat: vi.fn(async (options: ChatOptionsLike) => options.prompt),
    };

    const result = await firstValueFrom(
      redactor.chat$(endpoint, { prompt: "John secret" }),
    );

    expect(result).toBe("[NAME] secret");
    expect(endpoint.chat).toHaveBeenCalledWith({ prompt: "[NAME] secret" });
  });

  it("fails closed by default and supports explicit fail-open mode", async () => {
    const failingClient: ComprehendClientLike = {
      send: vi.fn(async () => {
        throw new Error("AWS unavailable");
      }) as unknown as ComprehendClientLike["send"],
    };

    await expect(
      new AwsComprehendRedactor({ client: failingClient }).redact("secret"),
    ).rejects.toThrow("AWS unavailable");

    await expect(
      new AwsComprehendRedactor({
        client: failingClient,
        failClosed: false,
      }).redact("secret"),
    ).resolves.toBe("secret");
  });
});

describe("AwsComprehendRedactor with the existing OpenAI endpoint", () => {
  afterEach(() => vi.restoreAllMocks());

  it("sends only redacted messages through OpenAI.chat after observable redaction", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue({
      data: { choices: [{ message: { content: "offline transport response" } }] },
    });
    const options = { messages: [{ role: "user", content: "John secret" }] };
    const redactor = new AwsComprehendRedactor({
      client: fakeClient([{ BeginOffset: 0, EndOffset: 4, Score: 1, Type: "NAME" }]),
    });
    const endpoint = new OpenAI({ apiKey: "offline-test", orgId: "offline-test" });

    await expect(firstValueFrom(redactor.chat$(endpoint, options))).resolves.toEqual({
      content: "offline transport response",
    });
    expect(post).toHaveBeenCalledTimes(1);
    const [url, body] = post.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(body.messages).toEqual([{ role: "user", content: "[NAME] secret" }]);
    expect(JSON.stringify(body)).not.toContain("John");
    expect(options.messages[0].content).toBe("John secret");
  });

  it("never invokes OpenAI transport when Comprehend fails closed", async () => {
    const post = vi.spyOn(axios, "post").mockRejectedValue(new Error("unexpected transport"));
    const client: ComprehendClientLike = {
      send: vi.fn(async () => { throw new Error("Comprehend unavailable"); }) as ComprehendClientLike["send"],
    };
    const endpoint = new OpenAI({ apiKey: "offline-test", orgId: "offline-test" });
    const options = { prompt: "John secret" };

    await expect(firstValueFrom(new AwsComprehendRedactor({ client }).chat$(endpoint, options)))
      .rejects.toThrow("Comprehend unavailable");
    expect(post).not.toHaveBeenCalled();
    expect(options.prompt).toBe("John secret");
  });
});
