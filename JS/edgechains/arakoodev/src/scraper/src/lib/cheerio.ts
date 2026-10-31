import axios from "axios";
import cheerio from "cheerio";
import { assertSafeScraperUrl, ScraperUrlOptions } from "../utils/url-validator.js";

export class Cheerio {
    constructor() {}
    async getContent(url: string, options?: ScraperUrlOptions): Promise<string> {
        const safeUrl = assertSafeScraperUrl(url, options);
        const content = await axios(safeUrl);
        const $ = cheerio.load(content.data);
        const data = `${$("h1").text()} ${$("p").text()} ${$("h2").text()} ${$("h3").text()} ${$("h4").text()} ${$("h5").text()} ${$("h6").text()}`;
        return data;
    }
}
