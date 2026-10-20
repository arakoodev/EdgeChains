import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { firstValueFrom } from "rxjs";
import {
  AwsComprehendRedactor,
  OpenAI,
  type ComprehendClientLike,
} from "@arakoodev/edgechains.js/ai";

// Load the Axios instance used by the SDK's compiled CommonJS OpenAI class.
const sdkRequire = createRequire(import.meta.resolve("@arakoodev/edgechains.js/ai"));
const axios = sdkRequire("axios");
const originalAdapter = axios.defaults.adapter;
const prompt = "Email Ada at ada@example.com about account 123-45-6789.";
const expected = "Email [NAME] at [EMAIL] about account [SSN].";
let interceptedCalls = 0;

const client: ComprehendClientLike = {
  async send(command) {
    assert.equal(command.input.Text, prompt);
    return {
      Entities: [
        { BeginOffset: 6, EndOffset: 9, Score: 1, Type: "NAME" },
        { BeginOffset: 13, EndOffset: 28, Score: 1, Type: "EMAIL" },
        { BeginOffset: 43, EndOffset: 54, Score: 1, Type: "SSN" },
      ],
      $metadata: {},
    };
  },
};

console.log("OFFLINE DEMO: injected Comprehend results and Axios transport.");
console.log("No live AWS/OpenAI request, provider response or billing is claimed.");
console.log("Synthetic input:", prompt);

axios.defaults.adapter = async (config: { url: string; data: string | object }) => {
  assert.equal(config.url, "https://api.openai.com/v1/chat/completions");
  const body = typeof config.data === "string" ? JSON.parse(config.data) : config.data;
  assert.deepEqual(body.messages, [{ role: "user", content: expected }]);
  for (const value of ["Ada", "ada@example.com", "123-45-6789"]) {
    assert.equal(JSON.stringify(body).includes(value), false);
  }
  interceptedCalls += 1;
  console.log("Existing OpenAI.chat outbound messages:", JSON.stringify(body.messages));
  console.log("Transport intercepted locally; external requests: 0.");
  return {
    data: { choices: [{ message: { role: "assistant", content: "OFFLINE transport acknowledgement" } }] },
    status: 200,
    statusText: "OK",
    headers: {},
    config,
  };
};

try {
  const redactor = new AwsComprehendRedactor({ client, minScore: 0.8 });
  console.log("Redacted:", await redactor.redact(prompt));
  const endpoint = new OpenAI({ apiKey: "offline-demo", orgId: "offline-demo" });
  const options = { prompt, max_tokens: 64 };
  const result = await firstValueFrom(redactor.chat$(endpoint, options));
  assert.equal(result.content, "OFFLINE transport acknowledgement");
  assert.equal(interceptedCalls, 1);
  assert.equal(options.prompt, prompt);
  console.log("Observable chain: AwsComprehendRedactor.chat$ -> existing OpenAI.chat -> offline adapter.");
  console.log("PASS: outbound PII removed, original input unchanged, exactly one intercepted call.");

  interceptedCalls = 0;
  const failingClient: ComprehendClientLike = {
    async send() { throw new Error("injected Comprehend outage"); },
  };
  await assert.rejects(
    firstValueFrom(new AwsComprehendRedactor({ client: failingClient }).chat$(endpoint, options)),
    /injected Comprehend outage/,
  );
  assert.equal(interceptedCalls, 0);
  console.log("PASS: fail-closed Comprehend error prevents OpenAI transport invocation.");
} finally {
  axios.defaults.adapter = originalAdapter;
}
