import { Cheerio } from "../../../../dist/scraper/src/index.js";
import { describe, expect, it } from "vitest";
describe("should scrape the page", async () => {
    it("should scrape the text and return", async () => {
        const url = "https://en.wikipedia.org/wiki/Akbar";
        const cheerio = new Cheerio();

        const result = await cheerio.getContent(url);
        expect(`${result}`).contains("Akbar");
    });
});
