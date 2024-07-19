import { Playwright } from "@arakoodev/edgechains.js/scraper"
const scraper = new Playwright();

async function getPageContent({ pageUrl, openai }: { pageUrl: string, openai: string }) {
    try {
        return await scraper.call({ chatApi: openai, task: `go to ${pageUrl} and scrap the hole page text`, headless: false })

    } catch (error) {
        console.log(error);
    }
}

module.exports = getPageContent;
