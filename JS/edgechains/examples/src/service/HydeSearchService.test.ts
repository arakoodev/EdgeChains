import { ArkRequest } from "../types/ArkRequest";
import { HydeSearchService } from "./HydeSearchService";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });
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
      (await HydeSearchService.request().hydeSearchAdaEmbedding(arkRequest))
        .finalAnswer,
    ).toContain("Java");
  }, 30000);
});
