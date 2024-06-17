import { WebScraper } from "@arakoodev/edgechains.js/scraper";
import axios from "axios";

const Jsonnet = require("@arakoodev/jsonnet");
const path = require("path");

const scraper = new WebScraper();
const jsonnet = new Jsonnet();
const secretsPath = path.join(__dirname, "../../jsonnet/secrets.jsonnet");
const key = JSON.parse(jsonnet.evaluateFile(secretsPath)).bing_api_key;


function bingWebSearch(query: string) {
    try {
        return axios(`https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&count=10`, {
            headers: { 'Ocp-Apim-Subscription-Key': key },
        }).then((response) => {
            return JSON.stringify(response.data.webPages.value);
        });

    } catch (error) {
        console.log(error)

    }
}


module.exports = bingWebSearch;