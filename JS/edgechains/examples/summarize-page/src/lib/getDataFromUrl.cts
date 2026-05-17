import { Playwright } from "@arakoodev/edgechains.js/scraper";
const scraper = new Playwright();

async function getPageContent({ task, openai }: { task: string; openai: string }) {
    try {
        return await scraper.call({ chatApi: openai, task, headless: false });
    } catch (error) {
        console.log(error);
    }
}

module.exports = getPageContent;
