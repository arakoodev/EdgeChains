import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ComprehendClient,
  type DetectPiiEntitiesCommandOutput,
} from "@aws-sdk/client-comprehend";
import { firstValueFrom, lastValueFrom, of, toArray } from "rxjs";
import { createServer, type Server } from "node:http";
import { ComprehendRedactor, type PiiClient } from "./index.js";

function fixture(Entities: DetectPiiEntitiesCommandOutput["Entities"] = []) {
  const send = vi.fn(async () => ({ Entities, $metadata: {} }));
  return { send, redactor: new ComprehendRedactor({ client: { send } }) };
}
const span = (BeginOffset: number, EndOffset: number) => ({
  BeginOffset,
  EndOffset,
});
const servers: Server[] = [];
const clients: ComprehendClient[] = [];
afterEach(async () => {
  for (const client of clients.splice(0)) client.destroy();
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  vi.useRealTimers();
});

describe("ComprehendRedactor", () => {
  it.each([0, -1, 1.5, NaN, Infinity, 2_147_483_648])(
    "rejects an unsupported timer delay: %s",
    (timeoutMs) => {
      expect(() => new ComprehendRedactor({ timeoutMs })).toThrow("timeoutMs");
    },
  );

  it("releases its own SDK client once without destroying borrowed clients", () => {
    const destroy = vi.spyOn(ComprehendClient.prototype, "destroy");
    try {
      const owned = new ComprehendRedactor({ region: "us-east-1" });
      owned.destroy();
      owned.destroy();
      expect(destroy).toHaveBeenCalledTimes(1);
      const borrowed = new ComprehendClient({ region: "us-east-1" });
      clients.push(borrowed);
      new ComprehendRedactor({ client: borrowed }).destroy();
      expect(destroy).toHaveBeenCalledTimes(1);
    } finally {
      destroy.mockRestore();
    }
  });

  it("aborts all active detection on destroy and prevents later endpoint calls", async () => {
    const signals: AbortSignal[] = [];
    const send = vi.fn((_, options: { abortSignal: AbortSignal }) => {
      signals.push(options.abortSignal);
      return new Promise<DetectPiiEntitiesCommandOutput>(() => {});
    });
    const redactor = new ComprehendRedactor({ client: { send } });
    const endpoint = vi.fn(async () => "sent");
    const first = expect(
      firstValueFrom(of({ prompt: "first" }).pipe(redactor.protect(endpoint))),
    ).rejects.toThrow("no text was forwarded");
    const second = expect(redactor.redact("second")).rejects.toThrow(
      "no text was forwarded",
    );
    redactor.destroy();
    await Promise.all([first, second]);
    expect(signals).toHaveLength(2);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
    await expect(redactor.redact("")).rejects.toThrow("destroyed");
    await expect(
      firstValueFrom(of({ messages: [] }).pipe(redactor.protect(endpoint))),
    ).rejects.toThrow("destroyed");
    expect(send).toHaveBeenCalledTimes(2);
    expect(endpoint).not.toHaveBeenCalled();
  });

  it("replaces multiple out-of-order ranges without changing the input", async () => {
    const { redactor } = fixture([span(18, 32), span(6, 10)]);
    expect(await redactor.redact("Hello Jane, email jane@demo.test.")).toBe(
      "Hello [REDACTED], email [REDACTED].",
    );
  });

  it("does not forward a prepared prompt after destruction", async () => {
    const { redactor, send } = fixture();
    const endpoint = vi.fn(async () => "sent");
    const assertion = expect(
      firstValueFrom(of({ prompt: "" }).pipe(redactor.protect(endpoint))),
    ).rejects.toThrow("destroyed");
    redactor.destroy();
    await assertion;
    expect(send).not.toHaveBeenCalled();
    expect(endpoint).not.toHaveBeenCalled();
  });

  it("uses Unicode character positions rather than UTF-16 indices", async () => {
    const { redactor } = fixture([span(2, 6)]);
    expect(await redactor.redact("🙂 Jane!")).toBe("🙂 [REDACTED]!");
  });

  it("treats combining characters as separate code points", async () => {
    const { redactor } = fixture([span(3, 7)]);
    expect(await redactor.redact("e\u0301 Jane!")).toBe("e\u0301 [REDACTED]!");
  });

  it("merges nested, duplicate and overlapping spans", async () => {
    const { redactor } = fixture([
      span(4, 8),
      span(1, 5),
      span(2, 3),
      span(1, 5),
    ]);
    expect(await redactor.redact("0123456789")).toBe("0[REDACTED]89");
  });

  it("redacts every detected span, including low-confidence and unknown types", async () => {
    const { redactor } = fixture([{ ...span(0, 4), Score: 0.01 }]);
    expect(await redactor.redact("Jane!")).toBe("[REDACTED]!");
  });

  it("passes unchanged text only for a valid empty detection list", async () => {
    expect(await fixture().redactor.redact("a public sentence")).toBe(
      "a public sentence",
    );
    const redactor = new ComprehendRedactor({
      client: { send: async () => ({ $metadata: {} }) },
    });
    await expect(redactor.redact("abc")).rejects.toThrow("invalid entity list");
  });

  it.each([
    span(-1, 2),
    span(0, 10),
    span(2, 2),
    span(2, 1),
    span(0.5, 2),
    { EndOffset: 2 },
  ])(
    "blocks malformed ranges before the endpoint is invoked: %j",
    async (entity) => {
      const { redactor } = fixture([entity]);
      const endpoint = vi.fn(async () => "sent");
      await expect(
        firstValueFrom(of({ prompt: "abc" }).pipe(redactor.protect(endpoint))),
      ).rejects.toThrow("invalid character range");
      expect(endpoint).not.toHaveBeenCalled();
    },
  );

  it("skips empty input and enforces UTF-8 byte limits before detection", async () => {
    const { redactor, send } = fixture();
    expect(await redactor.redact("")).toBe("");
    await expect(redactor.redact("🙂".repeat(25_001))).rejects.toThrow(
      "100 KB",
    );
    await expect(redactor.redact("bad \ud800")).rejects.toThrow("unpaired");
    expect(send).not.toHaveBeenCalled();
    await redactor.redact("a".repeat(100_000));
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("does not expose provider error text or call a downstream endpoint on failure", async () => {
    const redactor = new ComprehendRedactor({
      client: {
        send: async () => {
          throw new Error("secret@example.test");
        },
      },
    });
    const endpoint = vi.fn(async () => "sent");
    await expect(
      firstValueFrom(of({ prompt: "hello" }).pipe(redactor.protect(endpoint))),
    ).rejects.toThrow("PII detection failed; no text was forwarded");
    expect(endpoint).not.toHaveBeenCalled();
  });

  it("is cold, preserves source order and re-runs for a new subscription", async () => {
    const { redactor, send } = fixture();
    const output = of("one", "two").pipe(redactor.redactOperator(), toArray());
    expect(send).not.toHaveBeenCalled();
    expect(await lastValueFrom(output)).toEqual(["one", "two"]);
    expect(
      send.mock.calls.map(
        (args: unknown[]) =>
          (args[0] as { input: { Text: string } }).input.Text,
      ),
    ).toEqual(["one", "two"]);
    await lastValueFrom(output);
    expect(send).toHaveBeenCalledTimes(4);
  });

  it("copies prompt and all message contents before invoking a real endpoint interface", async () => {
    const { redactor } = fixture([span(0, 4)]);
    const input = Object.freeze({
      prompt: "Jane!",
      model: "model",
      messages: Object.freeze([
        Object.freeze({ role: "system", content: "Jane!" }),
      ]),
    });
    const endpoint = vi.fn(async (options: typeof input) => options);
    const result = await firstValueFrom(
      of(input).pipe(redactor.protect(endpoint)),
    );
    expect(result).toEqual({
      prompt: "[REDACTED]!",
      model: "model",
      messages: [{ role: "system", content: "[REDACTED]!" }],
    });
    expect(input.messages[0].content).toBe("Jane!");
    expect(endpoint).toHaveBeenCalledOnce();
  });

  it("validates all inputs before making any detection request", async () => {
    const { redactor, send } = fixture();
    const endpoint = vi.fn(async () => "sent");
    const input = {
      prompt: "valid",
      messages: [{ content: ["image"] }],
    } as never;
    await expect(
      firstValueFrom(of(input).pipe(redactor.protect(endpoint))),
    ).rejects.toThrow("plain text");
    expect(send).not.toHaveBeenCalled();
    expect(endpoint).not.toHaveBeenCalled();
  });

  it.each(["delete", "replace", "mutate"])(
    "snapshots message text before awaiting detection when the caller chooses to %s it",
    async (change) => {
      let finish!: (value: DetectPiiEntitiesCommandOutput) => void;
      const send = vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              finish = resolve;
            }),
        )
        .mockResolvedValue({ Entities: [span(0, 4)], $metadata: {} });
      const redactor = new ComprehendRedactor({ client: { send } });
      const originalMessages = [{ role: "user", content: "Jane!" }];
      const input: { prompt: string; messages?: typeof originalMessages } = {
        prompt: "public",
        messages: originalMessages,
      };
      const endpoint = vi.fn(async (options: typeof input) => options);
      const pending = firstValueFrom(
        of(input).pipe(redactor.protect(endpoint)),
      );
      if (change === "delete") delete input.messages;
      if (change === "replace") input.messages = [];
      if (change === "mutate") originalMessages[0].content = "different secret";
      finish({ Entities: [], $metadata: {} });
      expect(await pending).toEqual({
        prompt: "public",
        messages: [{ role: "user", content: "[REDACTED]!" }],
      });
      expect(send.mock.calls.map(([command]) => command.input.Text)).toEqual([
        "public",
        "Jane!",
      ]);
      expect(endpoint).toHaveBeenCalledOnce();
    },
  );

  it("does not forward partially redacted messages when a later detection fails", async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ Entities: [], $metadata: {} })
      .mockRejectedValueOnce(new Error("failed"));
    const redactor = new ComprehendRedactor({ client: { send } });
    const endpoint = vi.fn(async () => "sent");
    await expect(
      firstValueFrom(
        of({ messages: [{ content: "first" }, { content: "second" }] }).pipe(
          redactor.protect(endpoint),
        ),
      ),
    ).rejects.toThrow("no text was forwarded");
    expect(endpoint).not.toHaveBeenCalled();
  });

  it("aborts detection on unsubscribe and never invokes downstream", async () => {
    let signal: AbortSignal | undefined;
    let finish!: (value: DetectPiiEntitiesCommandOutput) => void;
    const client: PiiClient = {
      send: (_, options) => {
        signal = options.abortSignal;
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
    };
    const redactor = new ComprehendRedactor({ client });
    const endpoint = vi.fn(async () => "sent");
    const subscription = of({ prompt: "hello" })
      .pipe(redactor.protect(endpoint))
      .subscribe();
    subscription.unsubscribe();
    expect(signal?.aborted).toBe(true);
    finish({ Entities: [], $metadata: {} });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(endpoint).not.toHaveBeenCalled();
  });

  it("times out even when an injected detector ignores the abort signal", async () => {
    vi.useFakeTimers();
    const redactor = new ComprehendRedactor({
      timeoutMs: 20,
      client: { send: () => new Promise(() => {}) },
    });
    const assertion = expect(redactor.redact("hello")).rejects.toThrow(
      "PII detection failed",
    );
    await vi.advanceTimersByTimeAsync(20);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects pre-cancelled work without sending it", async () => {
    const { redactor, send } = fixture();
    const controller = new AbortController();
    controller.abort();
    await expect(redactor.redact("hello", controller.signal)).rejects.toThrow(
      "cancelled",
    );
    expect(send).not.toHaveBeenCalled();
  });

  it("uses the actual AWS SDK protocol against a local synthetic server", async () => {
    const requests: Array<{
      target: string | string[] | undefined;
      body: unknown;
    }> = [];
    const server = createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk);
      requests.push({
        target: req.headers["x-amz-target"],
        body: JSON.parse(Buffer.concat(chunks).toString()),
      });
      res.setHeader("content-type", "application/x-amz-json-1.1");
      res.end(
        JSON.stringify({
          Entities: [{ Type: "NAME", Score: 1, ...span(2, 6) }],
        }),
      );
    });
    servers.push(server);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("No test port");
    const client = new ComprehendClient({
      region: "us-east-1",
      endpoint: `http://127.0.0.1:${address.port}`,
      credentials: {
        accessKeyId: "LOCAL_TEST_ONLY",
        secretAccessKey: "LOCAL_TEST_ONLY",
      },
      maxAttempts: 1,
    });
    clients.push(client);
    const redactor = new ComprehendRedactor({ client, languageCode: "es" });
    expect(await firstValueFrom(redactor.redact$("🙂 Jane!"))).toBe(
      "🙂 [REDACTED]!",
    );
    expect(requests).toEqual([
      {
        target: "Comprehend_20171127.DetectPiiEntities",
        body: { LanguageCode: "es", Text: "🙂 Jane!" },
      },
    ]);
  });
});
