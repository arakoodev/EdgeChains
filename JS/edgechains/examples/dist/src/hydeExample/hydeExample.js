"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hydeSearchAdaEmbedding = void 0;
const node_jsonnet_1 = require("@hanazuki/node-jsonnet");
const path = require("path");
const OpenAiEndpoint_1 = require("../lib/OpenAiEndpoint");
const PostgresClient_1 = require("../lib/PostgresClient");
var PostgresDistanceMetric;
(function (PostgresDistanceMetric) {
    PostgresDistanceMetric["COSINE"] = "COSINE";
    PostgresDistanceMetric["IP"] = "IP";
    PostgresDistanceMetric["L2"] = "L2";
})(PostgresDistanceMetric || (PostgresDistanceMetric = {}));
const gpt3endpoint = new OpenAiEndpoint_1.OpenAiEndpoint(
    "https://api.openai.com/v1/chat/completions",
    "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",
    "",
    "gpt-3.5-turbo",
    "user",
    0.7
);
async function hydeSearchAdaEmbedding(arkRequest) {
    try {
        const table = "ada_hyde_prod";
        const namespace = "360_docs";
        const query = arkRequest.query;
        const topK = Number(arkRequest.topK);
        const jsonnet = new node_jsonnet_1.Jsonnet();
        const promptPath = path.join(process.cwd(), "./src/hydeExample/prompts.jsonnet");
        const hydePath = path.join(process.cwd(), "./src/hydeExample/hyde.jsonnet");
        const promptLoader = await jsonnet.evaluateFile(promptPath);
        const promptTemplate = JSON.parse(promptLoader).summary;
        let hydeLoader = await jsonnet
            .extString("promptTemplate", promptTemplate)
            .extString("time", "")
            .extString("query", query)
            .evaluateFile(hydePath);
        const prompt = JSON.parse(hydeLoader).prompt;
        const gptResponse = await gpt3endpoint.gptFn(prompt);
        const gpt3Responses = gptResponse.split("\n");
        const embeddingsListChain = Promise.all(
            gpt3Responses.map(async (resp) => {
                const embedding = await gpt3endpoint.embeddings(resp);
                return embedding;
            })
        );
        const dbClient = new PostgresClient_1.PostgresClient(
            await embeddingsListChain,
            PostgresDistanceMetric.IP,
            topK,
            20,
            table,
            namespace,
            arkRequest,
            15
        );
        const queryResult = await dbClient.dbQuery();
        const retrievedDocs = [];
        for (const embeddings of queryResult) {
            retrievedDocs.push(
                `${embeddings.raw_text}\n score:${embeddings.score}\n filename:${embeddings.filename}\n`
            );
        }
        if (retrievedDocs.join("").length > 4096) {
            retrievedDocs.length = 4096;
        }
        const currentTime = new Date().toLocaleString();
        const formattedTime = currentTime;
        const ansPromptSystem = JSON.parse(promptLoader).ans_prompt_system;
        hydeLoader = await jsonnet
            .extString(promptTemplate, ansPromptSystem)
            .extString("time", formattedTime)
            .extString("qeury", retrievedDocs.join(""))
            .evaluateFile(hydePath);
        const finalPromptSystem = JSON.parse(hydeLoader).prompt;
        const ansPromptUser = JSON.parse(promptLoader).ans_prompt_user;
        hydeLoader = await jsonnet
            .extString(promptTemplate, ansPromptUser)
            .extString("qeury", query)
            .evaluateFile(hydePath);
        const finalPromptUser = JSON.parse(hydeLoader).prompt;
        const chatMessages = [
            { role: "system", content: finalPromptSystem },
            { role: "user", content: finalPromptUser },
        ];
        const finalAnswer = await gpt3endpoint.gptFnChat(chatMessages);
        const response = {
            wordEmbeddings: queryResult,
            finalAnswer: finalAnswer,
        };
        return response;
    } catch (error) {
        console.error(error);
        throw error;
    }
}
exports.hydeSearchAdaEmbedding = hydeSearchAdaEmbedding;
//# sourceMappingURL=hydeExample.js.map
