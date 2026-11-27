# G-Eval response evaluator

LLM-as-a-judge evaluation of an AI-generated response against a rubric, following
the G-Eval paper (<https://arxiv.org/abs/2303.16634>, <https://github.com/nlpyang/geval>).

It scores a response on a 1–5 scale across four default aspects — **coherence**,
**consistency**, **fluency**, **relevance** — by asking a judge model to first write
a short justification and then emit a score.

## Usage

```ts
import { GevalEvaluator } from "@arakoodev/edgechains.js/ai";

const evaluator = new GevalEvaluator({
  apiKey: process.env.OPENAI_API_KEY,
  model: "gpt-4o-mini",
});

// Score one aspect.
const { score, reasoning } = await evaluator.evaluate({
  prompt: "Explain why the sky is blue.",
  response: "Because of Rayleigh scattering ...",
  context: "Rayleigh scattering scatters shorter wavelengths more strongly.",
  aspect: "coherence",
});

// Score all four aspects and average (G-Eval rubric aggregation).
const { results, average } = await evaluator.evaluateAll({
  prompt: "Explain why the sky is blue.",
  response: "Because of Rayleigh scattering ...",
});
```

## JSON template

`geval.jsonnet` is the jsonnet equivalent for use inside an EdgeChains jsonnet
pipeline. It builds the same evaluation prompt and invokes the judge through the
`arakoo.native('openAICall')` callback, matching the existing `chat-with-llm`
example.

External variables (set with `jsonnet.extString`):

| var              | meaning                                             |
| ---------------- | --------------------------------------------------- |
| `prompt`         | the user prompt that produced the response          |
| `response`       | the model-generated response to evaluate            |
| `context`        | source information the response is grounded in (`""`)|
| `aspect`         | `coherence` \| `consistency` \| `fluency` \| `relevance` |
| `openai_api_key` | API key used by the `openAICall` native callback    |

Output (JSON string): `{ aspect, evaluation_prompt, judge_output }`.

## Parsing

`parseGevalResponse(raw, aspect)` tolerates the canonical `Justification: ... Score: N`
format plus common variations (`Score: 4/5`, markdown-bold `**Score:** 3`, or a bare
trailing digit). It returns `{ aspect, score, reasoning, raw }` with `score` in `1..5`
(or `0` when nothing parseable).

## Tests

```sh
npx vitest run src/ai/src/tests/geval.test.ts
```

`scripts/geval_integration_test.cjs` is an optional live check that runs `geval.jsonnet`
through the real jsonnet WASM runtime with a real OpenAI-compatible judge. It requires
`OPENAI_BASE_URL` / `OPENAI_API_KEY` / `OPENAI_MODEL` to point at a reachable endpoint;
it is not part of CI.