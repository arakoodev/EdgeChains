import { Cheerio, assertSafeScraperUrl } from "../../../../dist/scraper/src/index.js";
import { describe, expect, it } from "vitest";
describe("should scrape the page", async () => {
    it("should scrape the text and return", async () => {
        const url = "https://en.wikipedia.org/wiki/Akbar";
        const cheerio = new Cheerio();

        const result = await cheerio.getContent(url);
        expect(`${result}`).contains("Akbar");
    });

    it("should block unsafe protocols and SSRF targets", async () => {
        const metadataUrl = "http://169.254.169.254/latest/meta-data/";
        expect(() => assertSafeScraperUrl("file:///etc/passwd")).toThrow(/Disallowed/);
        expect(() => assertSafeScraperUrl(metadataUrl)).toThrow(/Blocked SSRF/);
        expect(() => assertSafeScraperUrl("http://127.0.0.1:8080")).toThrow(/Blocked SSRF/);
    });
});
