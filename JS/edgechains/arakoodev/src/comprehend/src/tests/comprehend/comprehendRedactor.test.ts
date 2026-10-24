import { describe, expect, it, vi } from "vitest";
import type { ComprehendClient, PiiEntity } from "@aws-sdk/client-comprehend";
import {
  ComprehendPiiRedactor,
  type ChatEndpointLike,
} from "../../lib/comprehend/comprehendRedactor.js";

function pii(type: string, begin: number, end: number, score = 0.99): PiiEntity {
  return { Type: type, BeginOffset: begin, EndOffset: end, Score: score };
}

function clientReturning(entities: readonly PiiEntity[]) {
  return {
    send: vi.fn().mockResolvedValue({ Entities: entities }),
  } as unknown as Pick<ComprehendClient, "send">;
}

describe("ComprehendPiiRedactor", () => {
  it("replaces PII, preserves the original when requested, and emits one event", async () => {
    const text = "Contact Jane at jane@example.com.";
    const client = clientReturning([
      pii("NAME", 8, 12),
      pii("EMAIL", 16, 32),
    ]);
    const redactor = new ComprehendPiiRedactor({ client, keepOriginal: true });
    const observed = vi.fn();

    redactor.subscribe(observed);
    const result = await redactor.redact(text);

    expect(result).toEqual({
      originalText: text,
      redactedText: "Contact [NAME] at [EMAIL].",
      entities: expect.arrayContaining([
        expect.objectContaining({ Type: "NAME" }),
        expect.objectContaining({ Type: "EMAIL" }),
      ]),
    });
    expect(observed).toHaveBeenCalledOnce();
    expect(client.send).toHaveBeenCalledOnce();
  });

  it("supports type filtering, fixed-width masking, and malformed/overlapping offsets", async () => {
    const redactor = new ComprehendPiiRedactor({
      client: clientReturning([]),
      maskMode: "MASK_WITH_CHAR",
      entityTypes: ["EMAIL"],
    });

    const result = ComprehendPiiRedactor.redactWithEntities(
      "Jane jane@example.com",
      [
        pii("NAME", 0, 4),
        pii("EMAIL", 5, 21),
        pii("EMAIL", 6, 10),
        pii("EMAIL", -1, 2),
        pii("EMAIL", 5, 99),
      ],
      {
        maskMode: "MASK_WITH_CHAR",
        entityTypes: ["EMAIL"],
      },
    );

    expect(result.redactedText).toBe("Jane ****************");
    expect(result.entities).toHaveLength(1);
    expect(result.entities[0]?.Type).toBe("EMAIL");
  });

  it("redacts prompt and messages without mutating the caller object before endpoint dispatch", async () => {
    const client = clientReturning([
      pii("EMAIL", 9, 25),
      pii("EMAIL", 8, 24),
    ]);
    const redactor = new ComprehendPiiRedactor({ client });

    const endpoint: ChatEndpointLike<Record<string, unknown>, { ok: true }> = {
      chat: vi.fn().mockResolvedValue({ ok: true }),
    };

    const chained = redactor.chain(endpoint);
    const request = {
      prompt: "Email is jane@example.com",
      messages: [{ role: "user", content: "Again: jane@example.com" }],
      temperature: 0,
    };

    await expect(chained.chat(request)).resolves.toEqual({ ok: true });

    expect(request).toEqual({
      prompt: "Email is jane@example.com",
      messages: [{ role: "user", content: "Again: jane@example.com" }],
      temperature: 0,
    });
    expect(endpoint.chat).toHaveBeenCalledWith({
      prompt: "Email is [EMAIL]",
      messages: [{ role: "user", content: "Again: [EMAIL]" }],
      temperature: 0,
    });
    expect(chained.redactions).toHaveLength(2);
  });

  it("returns an unsubscribe closure and isolates observer failures", async () => {
    const redactor = new ComprehendPiiRedactor({
      client: clientReturning([pii("NAME", 0, 4)]),
    });
    const healthyListener = vi.fn();

    redactor.subscribe(() => {
      throw new Error("observer failure");
    });
    const unsubscribe = redactor.subscribe(healthyListener);

    await redactor.redact("Jane");
    unsubscribe();
    await redactor.redact("Jane");

    expect(healthyListener).toHaveBeenCalledOnce();
  });
});
