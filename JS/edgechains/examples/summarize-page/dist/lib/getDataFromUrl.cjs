"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const scraper_1 = require("@arakoodev/edgechains.js/scraper");
const scraper = new scraper_1.Playwright();
async function getPageContent({ pageUrl, openai }) {
    try {
        return await scraper.call({ chatApi: openai, task: `go to ${pageUrl} and scrap the hole page text`, headless: false });
    }
    catch (error) {
        console.log(error);
    }
}
module.exports = getPageContent;
