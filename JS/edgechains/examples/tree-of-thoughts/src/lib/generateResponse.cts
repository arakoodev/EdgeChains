const { TreeOfThoughtsChain, OpenAILLMClient } = require("@arakoodev/edgechains.js/ai");

/**
 * Native callback invoked from `jsonnet/main.jsonnet` via
 * `arakoo.native('treeOfThoughts')(...)`.
 *
 * Runs a breadth-first Tree-of-Thoughts search over the supplied problem and
 * returns the best path / answer found by the chain.
 */
async function treeOfThoughts({
    prompt,
    openAIApiKey,
    k = 3,
    breadth = 2,
    maxDepth = 3,
}: any) {
    try {
        const llm = new OpenAILLMClient({ apiKey: openAIApiKey });
        const tot = new TreeOfThoughtsChain({
            problem: prompt,
            llm,
            k,
            breadth,
            maxDepth,
        });
        const result = await tot.run();
        return JSON.stringify({
            answer: result.answer,
            score: result.score,
            bestPath: result.bestPath,
        });
    } catch (error) {
        return JSON.stringify({ error: String(error) });
    }
}

module.exports = treeOfThoughts;