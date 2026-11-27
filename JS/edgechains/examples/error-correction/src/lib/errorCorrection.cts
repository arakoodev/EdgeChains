const { ErrorCorrectionChain } = require("@arakoodev/edgechains.js/ai");

/**
 * Native handler invoked from `jsonnet/main.jsonnet` via
 * `arakoo.native("errorCorrection")(...)`.
 *
 * Runs the generate -> verify -> correct loop (arxiv 2311.08516) for a single
 * problem + optional candidate answer and returns the structured result as a
 * JSON string (jsonnet natives exchange strings).
 */
async function errorCorrection({
    problem,
    candidateAnswer,
    openAIApiKey,
    model,
    maxIterations,
}: any) {
    try {
        const chain = new ErrorCorrectionChain({
            apiKey: openAIApiKey,
            model: model || "gpt-3.5-turbo",
            maxIterations: maxIterations || 3,
        });

        const result = await chain.run({
            problem,
            candidateAnswer: candidateAnswer || undefined,
        });

        return JSON.stringify(result);
    } catch (error) {
        return JSON.stringify({ error: String(error) });
    }
}

module.exports = errorCorrection;