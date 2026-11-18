import { Hono } from "hono";
import { hydeSearchAdaEmbedding } from "../service/HydeSearchService.js";
import { HydeFragmentData } from "../types/HydeFragmentData.js";
const HydeSearchRouter = new Hono();

const escapeHtml = (value: unknown) =>
    String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

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
            <div class="card-body">${escapeHtml(data.final_answer)}</div>
        </div>
            <ul class="list-unstyled mb-0">
              ${data.responses.map(
                  (item) => `
                  <li>
                    <div class="card">
                      <div class="card-body">
                        ${
                            item.rawText != null
                                ? `<div class="card card-body">${escapeHtml(item.rawText)}</div>`
                                : `<div class="card card-body">${escapeHtml(item.metadata)}</div>`
                        }
                        ${
                            item.filename != null
                                ? `<div class="card card-body" style="color: blue;">${escapeHtml(item.filename)}</div>`
                                : ""
                        }
                        ${
                            item.titleMetadata != null
                                ? `<div class="card card-body" style="color: blue;">${escapeHtml(item.titleMetadata)}</div>`
                                : ""
                        }
                        ${
                            item.documentDate != null
                                ? `<div class="card card-body" style="color: blue;">${escapeHtml(item.documentDate)}</div>`
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
