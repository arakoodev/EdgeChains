// Tree of Thoughts (ToT) example for EdgeChains.
//
// Demonstrates a breadth-first Tree-of-Thoughts reasoning pass over a problem.
// The ToT chain (see
// JS/edgechains/arakoodev/src/ai/src/lib/tree-of-thoughts/treeOfThoughts.ts)
// generates k candidate thoughts per step, scores each, keeps the most
// promising `breadth` states, and expands them up to `maxDepth`, returning the
// best path found.
//
// Run with:
//   node --experimental-wasm-modules ./dist/index.js \
//     --ext-str openai_api_key=sk-... \
//     --ext-str problem="What is 17 * 24? Think step by step."

local problemTemplate = |||
  Problem to solve:
  {problem}

  Use the Tree-of-Thoughts chain to explore several reasoning paths,
  score each candidate thought, keep the most promising ones, and
  return the best final answer.
|||;

local key = std.extVar('openai_api_key');
local problem = std.extVar('problem');

local promptWithProblem = std.strReplace(problemTemplate, '{problem}', problem + '\n');

local main() =
  local response = arakoo.native('treeOfThoughts')({
    prompt: promptWithProblem,
    openAIApiKey: key,
    // ToT search hyper-parameters.
    k: 3,          // candidate thoughts per state
    breadth: 2,    // states kept for expansion each step (BFS beam width)
    maxDepth: 3,   // number of thought steps
  });
  response;

main()
