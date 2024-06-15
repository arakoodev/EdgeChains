import axios from "axios";
import cheerio from "cheerio";

export class WebScraper {
    constructor() { }
    async getContent(url: string): Promise<string> {
        const content = await axios(url);
        const $ = cheerio.load(content.data);
        const data = `${$("h1").text()} ${$("p").text()} ${$("h2").text()} ${$("h3").text()} ${$("h4").text()} ${$("h5").text()} ${$("h6").text()}`;
        return data;
    }
}
