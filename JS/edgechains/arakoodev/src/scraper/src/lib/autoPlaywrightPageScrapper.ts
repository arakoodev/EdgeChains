import { chromium } from "playwright";

export class AutoPlayWriteWebPageScrapper {
    constructor() {}

    async getContent(url: string): Promise<string> {
        const browser = await chromium.launch({
            headless: true,
        });
        const page = await browser.newPage();
        await page.goto(url, {
            waitUntil: "domcontentloaded",
        });
        const textContent = await page.innerText("html");
        await browser.close();
        const regex = new RegExp("\n", "g");
        return textContent.replace(regex, "").replace(/\s{2,}/g, " ");
    }
}
