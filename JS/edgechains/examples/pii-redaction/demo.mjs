import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { ComprehendRedactor } from "../../arakoodev/dist/redaction/src/index.js";
import { OpenAI } from "../../arakoodev/dist/ai/src/lib/openai/openai.js";

const require = createRequire(new URL("../../arakoodev/package.json", import.meta.url));
const { ComprehendClient } = require("@aws-sdk/client-comprehend");
const { firstValueFrom, of } = require("rxjs");
const axios = require("axios").default;
const live = process.argv.includes("--live");
if (process.argv.slice(2).some(arg => arg !== "--live")) throw new Error("Usage: node demo.mjs [--live]");
if (live && process.env.ALLOW_PAID_API_CALLS !== "yes") {
    throw new Error("Live mode sends synthetic text to paid AWS/OpenAI APIs. Set ALLOW_PAID_API_CALLS=yes only after approving those costs.");
}

const text = "🙂 Please greet Jane; use jane@example.test.";
const originalAdapter = axios.defaults.adapter;
let server;
let client;
let redactor;
let downstreamCalls = 0;
try {
    if (!live) {
        server = createServer(async (req, res) => {
            try {
                const chunks = [];
                for await (const chunk of req) chunks.push(chunk);
                const input = JSON.parse(Buffer.concat(chunks).toString());
                assert.equal(input.Text, text);
                assert.equal(req.headers["x-amz-target"], "Comprehend_20171127.DetectPiiEntities");
                const Entities = ["Jane", "jane@example.test"].map((value, index) => {
                    const BeginOffset = Array.from(text.slice(0, text.indexOf(value))).length;
                    return { BeginOffset, EndOffset: BeginOffset + Array.from(value).length, Type: index ? "EMAIL" : "NAME", Score: 1 };
                });
                res.setHeader("content-type", "application/x-amz-json-1.1");
                res.end(JSON.stringify({ Entities }));
            } catch {
                res.writeHead(400).end(JSON.stringify({ message: "Unexpected synthetic fixture request" }));
            }
        });
        await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
        client = new ComprehendClient({
            endpoint: `http://127.0.0.1:${server.address().port}`,
            region: "us-east-1", maxAttempts: 1,
            credentials: { accessKeyId: "LOCAL_TEST_ONLY", secretAccessKey: "LOCAL_TEST_ONLY" },
        });
        axios.defaults.adapter = async config => {
            assert.equal(config.url, "https://api.openai.com/v1/chat/completions");
            const body = JSON.parse(config.data);
            assert.equal(body.messages[0].content, "🙂 Please greet [REDACTED]; use [REDACTED].");
            downstreamCalls++;
            return { status: 200, statusText: "OK", headers: {}, config, data: { choices: [{ message: { content: "Synthetic model response: redacted prompt received." } }] } };
        };
    }
    console.log(live ? "LIVE: paid AWS Comprehend + OpenAI, synthetic text only" : "OFFLINE: AWS SDK -> localhost fixture; OpenAI class -> mock adapter. No cloud calls.");
    redactor = new ComprehendRedactor({ client, region: process.env.AWS_REGION ?? "us-east-1" });
    const openai = new OpenAI(live ? {} : { apiKey: "LOCAL_TEST_ONLY", orgId: "LOCAL_TEST_ONLY" });
    const safeText = await firstValueFrom(redactor.redact$(text));
    console.log("Redacted:", safeText);
    const reply = await firstValueFrom(of({ prompt: text }).pipe(redactor.protect(options => openai.chat(options))));
    console.log("Endpoint response:", reply.content);
    if (!live) assert.equal(downstreamCalls, 1);

    const broken = new ComprehendRedactor({ client: { send: async () => { throw new Error("synthetic detection outage"); } } });
    let unsafeCalls = 0;
    await assert.rejects(firstValueFrom(of({ prompt: text }).pipe(broken.protect(async () => { unsafeCalls++; return "unsafe"; }))), /no text was forwarded/);
    assert.equal(unsafeCalls, 0);
    console.log("Detection failure: blocked; downstream calls = 0");
    console.log("PASS: observable chain, Unicode ranges, and failure handling");
} finally {
    axios.defaults.adapter = originalAdapter;
    redactor?.destroy();
    client?.destroy();
    if (server) {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
    }
}
