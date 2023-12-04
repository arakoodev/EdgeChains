const wikiSummary = require('./WikiExample');


describe("Wiki Search", () => {
    it("should return a response", async () => {
        expect(
            (
                await wikiSummary('Barak Obama')
            )
        ).toContain("Barak Obama");
    }, 30000);
});