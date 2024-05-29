"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { WebScraper } = require("arakoodev/scraper");
const scraper = new WebScraper();
function getPageContent() {
    return (url) => {
        return scraper.getContent(url).then((res) => {
            return res;
        });
    };
}
module.exports = getPageContent;
