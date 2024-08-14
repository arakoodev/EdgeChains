import { Playwright } from "@arakoodev/edgechains.js/scraper";

async function doMainTasks({ task, openai }: { task: string; openai: string }) {
    const scraper = new Playwright({ apiKey: openai, model: "gpt-4-1106-preview" });
    try {
        return JSON.stringify(await scraper.call({ task, headless: false }))
    } catch (error) {
        console.log(error);
    }
}

module.exports = doMainTasks;
