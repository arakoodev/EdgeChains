
import { WebScraper } from "@arakoodev/edgechains.js/scraper";
const scraper = new WebScraper();

function getContent(url: string) {
    try {
        return scraper.getContent(url).then((res) => {
            console.log("Scraped Successfully: " + url);
            return res;
        }).catch((error) => {
            console.log("Error Scraping: " + url);
            return " ";
        })
    } catch (error) {
        console.log("Error Scraping: " + url);
        return " ";
    }
}


module.exports = getContent