
const { WebScraper } = require("arakoodev/scraper")

const scraper = new WebScraper();

function getPageContent() {
    return (url: string) => {
        return scraper.getContent(url).then((res: any) => {
            return res
        })
    }
}

module.exports = getPageContent;