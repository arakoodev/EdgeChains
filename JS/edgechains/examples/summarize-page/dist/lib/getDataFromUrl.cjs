"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { WebScraper } = require("@arakoodev/edgechains.js/scraper");
const scraper = new WebScraper();
function getPageContent() {
    return (url) => {
        try {
            return scraper.getContent(url).then((res) => {
                return res;
            });
        }
        catch (error) {
            console.log(error);
        }
    };
}
module.exports = getPageContent;
