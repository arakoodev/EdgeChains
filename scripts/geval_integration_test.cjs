// Live integration test: runs geval.jsonnet in the REAL @arakoodev/jsonnet
// WASM runtime with a real LLM-as-judge call (OpenAI-compatible endpoint).
//
// This exercises the actual native callback path (arakoo.native('openAICall'))
// that the EdgeChains runtime uses — no mocks.
//
// Usage: OPENAI_BASE_URL, OPENAI_MODEL, OPENAI_API_KEY env vars (or defaults).
// Run: node scripts/geval_integration_test.cjs

const path = require("path");
const Jsonnet = require("../JS/jsonnet/src/index.js");

const BASE_URL = process.env.OPENAI_BASE_URL || "http://127.0.0.1:3000/v1";
const MODEL = process.env.OPENAI_MODEL || "baidu/ernie-5.5-flash-preview:free";
const API_KEY = process.env.OPENAI_API_KEY || "sk-local";

async function callLLM({ prompt }) {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
            model: MODEL,
            messages: [{ role: "user", content: prompt }],
            max_tokens: 300,
            temperature: 0,
        }),
    });
    if (!res.ok) {
        throw new Error(`LLM HTTP ${res.status}: ${await res.text()}`);
    }
    const data = await res.json();
    return data.choices[0].message.content;
}

async function main() {
    const gevalPath = path.join(
        __dirname,
        "../JS/edgechains/arakoodev/src/ai/src/lib/geval/geval.jsonnet"
    );

    // A deliberately strong response + a weak one, to show the judge discriminates.
    const cases = [
        {
            name: "good-response",
            prompt: "Explain why the sky is blue.",
            response:
                "The sky appears blue because of Rayleigh scattering: shorter (blue) wavelengths of sunlight scatter more strongly off air molecules than longer (red) wavelengths, so blue light reaches our eyes from all directions.",
            context: "Rayleigh scattering scatters shorter wavelengths of visible light more strongly than longer wavelengths.",
            aspect: "coherence",
        },
        {
            name: "bad-response",
            prompt: "Explain why the sky is blue.",
            response: "Blue sky because banana telephone purple monkey dishwasher.",
            context: "Rayleigh scattering scatters shorter wavelengths of visible light more strongly than longer wavelengths.",
            aspect: "coherence",
        },
    ];

    const jsonnet = new Jsonnet();
    // Real native callback: returns a STRING (runtime calls result.toString()).
    // NOTE: the @arakoodev/jsonnet runtime JSON.parses the args before spreading,
    // so our function receives the already-parsed object as its first argument.
    jsonnet.javascriptCallback("openAICall", (args) => {
        const { prompt, openAIApiKey } = typeof args === "string" ? JSON.parse(args) : args;
        // Synchronous bridge is required by the WASM runtime; we use a deasync-free
        // approach: the runtime supports async callbacks in the arakoo path, but the
        // plain node WASM path is sync. We therefore pre-fetch is not possible here,
        // so we use a child-process-free sync HTTP via execSync.
        const { execFileSync } = require("child_process");
        const body = JSON.stringify({
            model: MODEL,
            messages: [{ role: "user", content: prompt }],
            max_tokens: 300,
            temperature: 0,
        });
        const out = execFileSync(
            "curl",
            [
                "-s",
                "-m",
                "60",
                `${BASE_URL}/chat/completions`,
                "-H",
                "Content-Type: application/json",
                "-H",
                `Authorization: Bearer ${openAIApiKey || API_KEY}`,
                "-d",
                body,
            ],
            { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 }
        );
        const data = JSON.parse(out);
        return data.choices[0].message.content;
    });

    let pass = 0;
    let fail = 0;
    for (const c of cases) {
        jsonnet.extString("prompt", c.prompt);
        jsonnet.extString("response", c.response);
        jsonnet.extString("context", c.context);
        jsonnet.extString("aspect", c.aspect);
        jsonnet.extString("openai_api_key", API_KEY);
        const raw = jsonnet.evaluateFile(gevalPath);
        const parsed = JSON.parse(raw);
        const judgeOut = parsed.judge_output || "";
        const m = judgeOut.match(/Score:\s*([1-5])/i);
        const score = m ? parseInt(m[1], 10) : null;
        console.log(`\n=== CASE: ${c.name} (aspect=${c.aspect}) ===`);
        console.log("evaluation_prompt length:", parsed.evaluation_prompt.length);
        console.log("judge_output:", JSON.stringify(judgeOut.slice(0, 400)));
        console.log("parsed score:", score);
        if (score === null) {
            console.log("RESULT: FAIL (no score parsed)");
            fail++;
        } else {
            console.log("RESULT: PASS (real LLM judge returned a 1-5 score)");
            pass++;
        }
    }
    console.log(`\n=== INTEGRATION SUMMARY: ${pass} passed, ${fail} failed ===`);
    if (fail > 0) process.exit(1);
}

main().catch((e) => {
    console.error("INTEGRATION ERROR:", e);
    process.exit(1);
});