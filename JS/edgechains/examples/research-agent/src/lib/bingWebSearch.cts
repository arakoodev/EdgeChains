import axios from "axios";

async function bingWebSearch({ query, key }: { query: string; key: string }) {
    try {
        const response = await axios(
            `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&count=10`,
            {
                headers: { "Ocp-Apim-Subscription-Key": key },
            }
        );
        return JSON.stringify(response.data.webPages.value);
    } catch (error) {
        console.log(error);
    }
}

module.exports = bingWebSearch;
