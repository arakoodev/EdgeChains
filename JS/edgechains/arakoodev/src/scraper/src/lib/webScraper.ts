import request from 'request';
import cheerio from 'cheerio';

export class WebScraper {
    constructor() { }
    async getContent(url: string): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            request(url, (error: any, response: any, html: string) => {
                if (!error && response.statusCode == 200) {
                    const $ = cheerio.load(html);
                    const contentArr: string[] = [];

                    $('p').each((index: number, element:any) => {
                        const paragraphText: string = $(element).text();
                        contentArr.push(paragraphText);
                    });

                    resolve(contentArr.join(' ').trim());
                } else {
                    reject('Error: ' + error);
                }
            });
        });
    }
}