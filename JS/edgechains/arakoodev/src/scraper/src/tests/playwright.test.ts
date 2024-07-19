import { Playwright } from "../../../../dist/scraper/src/index.js";
import { describe, expect, it } from "vitest";

describe("should scrape the page", async () => {
    it("should scrape the text and return", async () => {
        const playwright = new Playwright();

        const result = await playwright.call({
            chatApi: "11111",
            task: "go to wikipedia and search for Akbar and click on any articial and scrap the hole page text",
            headless: false,
        });
        expect(result).toContain(String);
    });
}, 1000000);
