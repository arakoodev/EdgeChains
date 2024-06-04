const { WebScraper } = require("@arakoodev/edgechains.js/scraper");

const scraper = new WebScraper();

function getPageContent() {
    return (url: string) => {
        try {
            return scraper.getContent(url).then((res: any) => {
                return res;
            });
        } catch (error) {
            console.log(error);
        }
    };
}

module.exports = getPageContent;
