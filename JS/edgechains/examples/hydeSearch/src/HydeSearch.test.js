import dotenv from "dotenv";
import { hydeSearchAdaEmbedding } from "./HydeSearch.js";
dotenv.config({ path: ".env" });
describe("Hyde Search", () => {
    it("should return a response", async () => {
        const arkRequest = {
            topK: 5,
            metadataTable: "title_metadata",
            query: "tell me the top 5 programming languages currently",
            textWeight: {
                baseWeight: "1.0",
                fineTuneWeight: "0.35",
            },
            similarityWeight: {
                baseWeight: "1.5",
                fineTuneWeight: "0.40",
            },
            dateWeight: {
                baseWeight: "1.25",
                fineTuneWeight: "0.75",
            },
            orderRRF: "default",
        };
        expect(
            (
                await hydeSearchAdaEmbedding(
                    arkRequest,
                    process.env.OPENAI_API_KEY,
                    process.env.OPENAI_ORG_ID
                )
            ).finalAnswer
        ).toContain("Java");
    }, 30000);
});
