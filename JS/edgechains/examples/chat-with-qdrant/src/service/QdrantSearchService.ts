import path from "path";
import { fileURLToPath } from "url";
import Jsonnet from "@arakoodev/jsonnet";
import { QdrantClient, QdrantDistanceMetric } from "@arakoodev/edgechains.js/vector-db";
import { localEmbed } from "../lib/localEmbed.js";
import { COLLECTION_NAME, NAMESPACE, VECTOR_SIZE } from "../lib/InsertToQdrant.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type QdrantSearchRequest = {
    query: string;
    topK?: number;
};

/**
 * Mirrors HydeSearchService: jsonnet owns the prompt templates, QdrantClient
 * owns retrieval (same constructor shape as PostgresClient).
 */
export async function qdrantSearchAdaEmbedding(
    arkRequest: QdrantSearchRequest,
    qdrantUrl: string,
    qdrantApiKey: string
) {
    const jsonnet = new Jsonnet();
    const promptPath = path.join(__dirname, "../../jsonnet/prompts.jsonnet");
    const hydePath = path.join(__dirname, "../../jsonnet/hyde.jsonnet");
    const promptLoader = jsonnet.evaluateFile(promptPath);
    const promptTemplate = JSON.parse(promptLoader).summary;

    const hydeLoader = jsonnet
        .extString("promptTemplate", promptTemplate)
        .extString("time", "")
        .extString("query", arkRequest.query)
        .evaluateFile(hydePath);
    const hypotheticalPrompt = JSON.parse(hydeLoader).prompt;

    // Local embeddings keep the example runnable without OpenAI.
    // HydeSearchService instead embeds the LLM hypothetical answer.
    const queryEmbedding = localEmbed(`${arkRequest.query}\n${hypotheticalPrompt}`, VECTOR_SIZE);

    const dbClient = new QdrantClient(
        [queryEmbedding],
        QdrantDistanceMetric.COSINE,
        arkRequest.topK ?? 3,
        16,
        COLLECTION_NAME,
        NAMESPACE,
        { query: arkRequest.query, orderRRF: "similarity" },
        5,
        qdrantUrl,
        qdrantApiKey
    );

    const queryResult = await dbClient.dbQuery();
    const retrievedDocs = queryResult.map(
        (row) => `${row.raw_text}\n score:${row.score}\n filename:${row.filename}\n`
    );

    const ansPromptSystem = JSON.parse(promptLoader).ans_prompt_system;
    const finalPromptSystem = JSON.parse(
        new Jsonnet()
            .extString("promptTemplate", ansPromptSystem)
            .extString("time", "")
            .extString("query", retrievedDocs.join(""))
            .evaluateFile(hydePath)
    ).prompt;

    const ansPromptUser = JSON.parse(promptLoader).ans_prompt_user;
    const finalPromptUser = JSON.parse(
        new Jsonnet()
            .extString("promptTemplate", ansPromptUser)
            .extString("time", "")
            .extString("query", arkRequest.query)
            .evaluateFile(hydePath)
    ).prompt;

    return {
        wordEmbeddings: queryResult,
        finalAnswer: finalPromptSystem + "\n" + finalPromptUser,
        hypotheticalPrompt,
    };
}
