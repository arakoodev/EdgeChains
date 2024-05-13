const axios = require("axios");

function callWikipediaApi() {
    return function (searchQuery: string) {
        const url = "https://en.wikipedia.org/w/api.php";

        const queryParams = new URLSearchParams({
            action: "query",
            format: "json",
            list: "search",
            formatversion: "2",
            srsearch: searchQuery,
        });

        const apiUrl = `${url}?${queryParams.toString()}`;

        try {
            const response = axios(apiUrl).then((res: any) => {
                return JSON.stringify(res.data.query.search);
            });
            return response;
        } catch (error) {
            console.error("Error fetching data:", error);
            throw error;
        }
    };
}

module.exports = callWikipediaApi;
