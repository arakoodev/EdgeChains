import { Playwright } from "@arakoodev/edgechains.js/scraper";

async function call({ task, openai }: { task: string; openai: string }) {
    const scraper = new Playwright({ apiKey: openai });
    try {
        return await scraper.call({ task, headless: false });
    } catch (error) {
        console.log(error);
    }
}

module.exports = call;
