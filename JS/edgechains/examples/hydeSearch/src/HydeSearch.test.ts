import { ArkRequest } from "@arakoodev/edgechains.js";
// import dotenv from "dotenv";
import { hydeSearchAdaEmbedding } from "./HydeSearch";

let OPENAI_API_KEY = "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";
let OPENAI_ORG_ID = "org-ha7bPSLcoUnYzUMZ5xAogTgo";

// dotenv.config({ path: ".env" });
describe("Hyde Search", () => {
    it("should return a response", async () => {
        const arkRequest: ArkRequest = {
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
                    OPENAI_API_KEY!,
                    OPENAI_ORG_ID!
                )
            ).finalAnswer
        ).toContain("Java");
    }, 30000);
});
