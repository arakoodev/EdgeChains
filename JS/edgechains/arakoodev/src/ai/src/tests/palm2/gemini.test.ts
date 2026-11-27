import { afterEach, expect, test, vi } from "vitest";
import axios from "axios";
import { createServer, Server } from "node:http";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { GeminiAI } from "../../index";

const originalRequest = axios.request.bind(axios);
vi.spyOn(axios, "request").mockImplementation((config) => {
  if (new URL(config.url!).hostname !== "127.0.0.1")
    throw new Error("External network disabled in tests");
  return originalRequest(config);
});

const require = createRequire(import.meta.url);
const Jsonnet = require(resolve(process.cwd(), "../../jsonnet/src/jsonnet.js"));
const engine = new Jsonnet();
const fixture = JSON.parse(
  engine.evaluateSnippet(
    readFileSync(
      resolve(process.cwd(), "testcases/palm2/prompts.jsonnet"),
      "utf8",
    ),
  ),
);
engine.destroy();
let server: Server | undefined;
const calls: { url?: string; body: any; key?: string }[] = [];
async function listen(statuses = [200]) {
  calls.length = 0;
  server = createServer(async (request, response) => {
    let data = "";
    for await (const chunk of request) data += chunk;
    calls.push({
      url: request.url,
      body: JSON.parse(data),
      key: request.headers["x-goog-api-key"] as string,
    });
    response.setHeader("content-type", "application/json");
    response.statusCode =
      statuses[Math.min(calls.length - 1, statuses.length - 1)];
    response.end(
      JSON.stringify({
        candidates: [{ content: { parts: [{ text: fixture.responseText }] } }],
      }),
    );
  });
  await new Promise<void>((r) => server!.listen(0, "127.0.0.1", r));
  const address = server.address() as { port: number };
  return new GeminiAI({
    apiKey: "synthetic-fixture-key",
    baseUrl: `http://127.0.0.1:${address.port}/v1beta`,
  });
}
afterEach(async () => {
  if (server)
    await new Promise<void>((resolve, reject) =>
      server!.close((e) => (e ? reject(e) : resolve())),
    );
  server = undefined;
});

test("uses selected model and Jsonnet prompt with nested generationConfig", async () => {
  const client = await listen();
  const result = await client.chat({
    model: fixture.model,
    prompt: fixture.prompt,
    temperature: 0,
    max_output_tokens: 32,
    responseType: "application/json",
    delay: 0,
  });
  expect(calls[0].url).toBe(`/v1beta/models/${fixture.model}:generateContent`);
  expect(calls[0].body.contents[0].parts[0].text).toBe(fixture.prompt);
  expect(calls[0].body.generationConfig).toEqual({
    temperature: 0,
    maxOutputTokens: 32,
    responseMimeType: "application/json",
  });
  expect(calls[0].key).toBe("synthetic-fixture-key");
  expect(result.candidates?.[0].content?.parts[0].text).toBe(
    fixture.responseText,
  );
});

test("uses current alias by default and accepts models/ prefix", async () => {
  const client = await listen();
  await client.chat({ prompt: fixture.prompt });
  await client.chat({
    prompt: fixture.prompt,
    model: `models/${fixture.model}`,
  });
  expect(calls[0].url).toContain("/models/gemini-flash-latest:generateContent");
  expect(calls[1].url).toContain(`/models/${fixture.model}:generateContent`);
});

test("does not retry client errors or expose request credentials", async () => {
  const client = await listen([400]);
  await expect(
    client.chat({ prompt: fixture.prompt, delay: 0 }),
  ).rejects.toThrow("HTTP 400");
  expect(calls).toHaveLength(1);
});

test("retries transient failure within requested attempt budget", async () => {
  const client = await listen([503, 200]);
  await client.chat({ prompt: fixture.prompt, delay: 0, max_retry: 2 });
  expect(calls).toHaveLength(2);
});

test("rejects invalid model and numeric options before transport", async () => {
  const client = await listen();
  await expect(
    client.chat({ prompt: fixture.prompt, model: "../../other" }),
  ).rejects.toThrow("model");
  await expect(
    client.chat({ prompt: fixture.prompt, max_retry: 0 }),
  ).rejects.toThrow("max_retry");
  await expect(
    client.chat({ prompt: fixture.prompt, temperature: Number.NaN }),
  ).rejects.toThrow("temperature");
  expect(calls).toHaveLength(0);
});
