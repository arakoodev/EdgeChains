# Issue #52 — Tree of Thoughts (EdgeChains)

## PR
https://github.com/arakoodev/EdgeChains/pull/875  (OPEN, MERGEABLE, base=`ts`, head=`bounty-52`)
Closes #52

## What was implemented
`TreeOfThoughtsChain` — a real breadth-first Tree-of-Thoughts reasoning chain under
`JS/edgechains/arakoodev/src/ai/src/lib/tree-of-thoughts/treeOfThoughts.ts`, mirroring the
existing OpenAI provider pattern. Given a problem it:
1. Generates `k` candidate thoughts per step via a provider-agnostic LLM client.
2. Scores/evaluates each candidate.
3. Keeps the most promising `breadth` states (beam pruning).
4. Expands them BFS up to `maxDepth`, backtracking to the best-scoring path.
5. Returns `{ answer, score, bestPath }`.

Exported from `ai/src/index.ts`: `TreeOfThoughtsChain`, `OpenAILLMClient`,
`TreeOfThoughtsOptions`, `TreeOfThoughtsResult`, `OpenAILLMClientOptions`.

## Files (10)
- src/ai/src/lib/tree-of-thoughts/treeOfThoughts.ts (chain, 335 lines)
- src/ai/src/index.ts (exports)
- src/ai/src/tests/treeOfThoughts.test.ts (9 Vitest tests)
- examples/tree-of-thoughts/{jsonnet/main.jsonnet, jsonnet/secrets.jsonnet,
  src/index.ts, src/lib/generateResponse.cts, package.json, tsconfig.json, readme.md}
  — complete runnable ArakooServer example registering the `treeOfThoughts` native,
  mirroring the chat-with-llm example structure.

## Verification (real output)
Build:  `npx tsc -b`  -> exit 0
Tests:  `npx vitest run src/tests/treeOfThoughts.test.ts`
  ✓ src/tests/treeOfThoughts.test.ts (9 tests) 4ms
  Test Files  1 passed (1)
       Tests  9 passed (9)

## Notes
- Production bug fixed during dev: root/problem node was scored 1 so the search
  returned the bare problem statement; root is now excluded from answer eligibility.
- Example tsc requires `npm install` (deps not vendored), same as the reference
  chat-with-llm example.
