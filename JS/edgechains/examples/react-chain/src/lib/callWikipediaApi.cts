const axios = require("axios");

function findMatch(text: string, searchString: string): Boolean {
    if (text.includes(searchString) || searchString.includes(text)) {
        return true;
    }
    return false;
}

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
            return axios(apiUrl).then((res: any) => {
                let val: any;
                while (!val) {
                    const response = res.data.query.search;
                    const searchLength = response.length;
                    for (let i = 0; i < searchLength; i++) {
                        const title = response[i].title;
                        if (findMatch(title, searchQuery)) {
                            val = response[i].pageid;
                        }
                    }
                }
                return val;
            });
        } catch (error) {
            console.error("Error fetching data:", error);
            throw error;
        }
    };
}

module.exports = callWikipediaApi;
