import { chromium } from "playwright";
import { assertSafeScraperUrl, ScraperUrlOptions } from "../utils/url-validator.js";

export class AutoPlayWriteWebPageScrapper {
    constructor() {}

    async getContent(url: string, options?: ScraperUrlOptions): Promise<string> {
        const safeUrl = assertSafeScraperUrl(url, options);
        const browser = await chromium.launch({
            headless: true,
        });
        try {
            const page = await browser.newPage();
            await page.goto(safeUrl, {
                waitUntil: "domcontentloaded",
            });
            const textContent = await page.innerText("html");
            const regex = new RegExp("\n", "g");
            return textContent.replace(regex, "").replace(/\s{2,}/g, " ");
        } finally {
            await browser.close();
        }
    }
}
