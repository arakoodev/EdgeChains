import Jsonnet from "@arakoodev/jsonnet";
import { OpenAiEndpoint } from "@arakoodev/edgechains.js";
import { PostgresClient } from "@arakoodev/edgechains.js";
import type { ArkRequest } from "@arakoodev/edgechains.js";
import * as path from "path";
import { Hono } from "hono";
const HydeSearchRouter = new Hono();

enum PostgresDistanceMetric {
    COSINE = "COSINE",
    IP = "IP",
    L2 = "L2",
}

export interface HydeFragmentData {
    responses: Array<{
        rawText?: string;
        metadata?: string;
        filename?: string;
        titleMetadata?: string;
        documentDate?: string;
    }>;
    final_answer?: string;
}

async function hydeSearchAdaEmbedding(arkRequest: ArkRequest, apiKey: string, orgId: string) {
    try {
        const gpt3endpoint = new OpenAiEndpoint(
            "https://api.openai.com/v1/chat/completions",
            apiKey,
            orgId,
            "gpt-3.5-turbo",
            "user",
            parseInt("0.7")
        );
        // Get required params from API...
        const table = "ada_hyde_prod";
        const namespace = "360_docs";
        const query = arkRequest.query;
        const topK = Number(arkRequest.topK);

        //
        const jsonnet = new Jsonnet();

        const promptPath = path.join(__dirname, "../jsonnet/prompts.jsonnet");
        const hydePath = path.join(__dirname, "../jsonnet/hyde.jsonnet");
        // Load Jsonnet to extract args..
        const promptLoader = jsonnet.evaluateFile(promptPath);

        // Getting ${summary} basePrompt
        const promptTemplate = JSON.parse(promptLoader).summary;
        // Getting the updated promptTemplate with query
        let hydeLoader = jsonnet
            .extString("promptTemplate", promptTemplate)
            .extString("time", "")
            .extString("query", query)
            .evaluateFile(hydePath);

        // Get concatenated prompt
        const prompt = JSON.parse(hydeLoader).prompt;

        // Block and get the response from GPT3
        const gptResponse = await gpt3endpoint.gptFn(prompt);

        // Chain 1 ==> Get Gpt3Response & split
        const gpt3Responses = gptResponse.split("\n");

        // Chain 2 ==> Get Embeddings from OpenAI using Each Response
        const embeddingsListChain: Promise<number[][]> = Promise.all(
            gpt3Responses.map(async (resp) => {
                const embedding = await gpt3endpoint.embeddings(resp);
                return embedding;
            })
        );

        // Chain 5 ==> Query via EmbeddingChain
        const dbClient = new PostgresClient(
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

        // Chain 6 ==> Create Prompt using Embeddings
        const retrievedDocs: string[] = [];

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

        // System prompt
        const ansPromptSystem = JSON.parse(promptLoader).ans_prompt_system;

        hydeLoader = jsonnet
            .extString(promptTemplate, ansPromptSystem)
            .extString("time", formattedTime)
            .extString("qeury", retrievedDocs.join(""))
            .evaluateFile(hydePath);

        const finalPromptSystem = JSON.parse(hydeLoader).prompt;

        // User prompt
        const ansPromptUser = JSON.parse(promptLoader).ans_prompt_user;

        hydeLoader = jsonnet
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
        // Handle errors here
        console.error(error);
        throw error;
    }
}

export { hydeSearchAdaEmbedding };

HydeSearchRouter.get("/search", async (c) => {
    const query = c.req.query();
    const arkRequest = {
        topK: parseInt(query.topK ?? "5"),
        metadataTable: query.metadataTable,
        query: query.query,
        textWeight: {
            baseWeight: query.textBaseWeight,
            fineTuneWeight: query.textFineTuneWeight,
        },
        similarityWeight: {
            baseWeight: query.similarityBaseWeight,
            fineTuneWeight: query.similarityFineTuneWeight,
        },
        dateWeight: {
            baseWeight: query.dateBaseWeight,
            fineTuneWeight: query.dateFineTuneWeight,
        },
        orderRRF: query.orderRRF,
    };
    const answer = await hydeSearchAdaEmbedding(
        arkRequest,
        process.env.OPENAI_API_KEY!,
        process.env.OPENAI_ORG_ID!
    );
    const final_answer = answer.finalAnswer;
    const responses = answer.wordEmbeddings;
    const data: HydeFragmentData = { responses, final_answer };
    return c.html(`
    <html lang="en">
    <div>
        <div class="card card-active">
            <div class="card-body">${data.final_answer}</div>
        </div>
            <ul class="list-unstyled mb-0">
              ${data.responses.map(
                  (item) => `
                  <li>
                    <div class="card">
                      <div class="card-body">
                        ${
                            item.rawText != null
                                ? `<div class="card card-body">${item.rawText}</div>`
                                : `<div class="card card-body">${item.metadata}</div>`
                        }
                        ${
                            item.filename != null
                                ? `<div class="card card-body" style="color: blue;">${item.filename}</div>`
                                : ""
                        }
                        ${
                            item.titleMetadata != null
                                ? `<div class="card card-body" style="color: blue;">${item.titleMetadata}</div>`
                                : ""
                        }
                        ${
                            item.documentDate != null
                                ? `<div class="card card-body" style="color: blue;">${item.documentDate}</div>`
                                : ""
                        }
                      </div>
                    </div>
                  </li>
                `
              )}
            </ul>
  </html>
    `);
});

export { HydeSearchRouter };
