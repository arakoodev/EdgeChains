import { Hono } from "hono";
import { hydeSearchAdaEmbedding } from "../service/HydeSearchService.js";
const HydeSearchRouter = new Hono();
HydeSearchRouter.get("/search", async (c) => {
    const query = await c.req.query();
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
        process.env.OPENAI_API_KEY,
        process.env.OPENAI_ORG_ID
    );
    const final_answer = answer.finalAnswer;
    const responses = answer.wordEmbeddings;
    const data = { responses, final_answer };
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
