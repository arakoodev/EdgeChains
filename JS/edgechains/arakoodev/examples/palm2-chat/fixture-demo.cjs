const { createServer } = require("node:http");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { GeminiAI } = require("../../dist/ai/src/index.js");
const Jsonnet = require(
  resolve(__dirname, "../../../../jsonnet/src/jsonnet.js"),
);

async function main() {
  const vm = new Jsonnet();
  let fixture;
  try {
    fixture = JSON.parse(
      vm.evaluateSnippet(
        readFileSync(
          resolve(__dirname, "../../testcases/palm2/prompts.jsonnet"),
          "utf8",
        ),
      ),
    );
  } finally {
    vm.destroy();
  }
  const server = createServer(async (request, response) => {
    let data = "";
    for await (const chunk of request) data += chunk;
    const body = JSON.parse(data);
    if (
      request.url !== `/v1beta/models/${fixture.model}:generateContent` ||
      body.contents[0].parts[0].text !== fixture.prompt ||
      body.generationConfig.temperature !== 0
    ) {
      response.writeHead(400).end();
      return;
    }
    response.setHeader("content-type", "application/json");
    response.end(
      JSON.stringify({
        candidates: [{ content: { parts: [{ text: fixture.responseText }] } }],
      }),
    );
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    const client = new GeminiAI({
      apiKey: "synthetic-fixture-key",
      baseUrl: `http://127.0.0.1:${server.address().port}/v1beta`,
    });
    const result = await client.chat({
      model: fixture.model,
      prompt: fixture.prompt,
      temperature: 0,
    });
    if (result.candidates?.[0].content?.parts[0].text !== fixture.responseText)
      throw new Error("Unexpected response");
    console.log(
      "Jsonnet WASM -> compiled public GeminiAI -> loopback HTTP fixture: PASS",
    );
    console.log(
      "Model:",
      fixture.model,
      "| temperature: 0 | prompt loaded from Jsonnet",
    );
    console.log("Response:", result.candidates[0].content.parts[0].text);
    console.log("Synthetic fixture only; no Google live-service verification.");
  } finally {
    await new Promise((r) => server.close(r));
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
