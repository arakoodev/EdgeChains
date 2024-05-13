const axios = require("axios");

function getExtractedSummary() {
    return function (pageId: string) {
        const url = "https://en.wikipedia.org/w/api.php";
        const queryParams = new URLSearchParams({
            action: "query",
            format: "json",
            exintro: "",
            explaintext: "",
            prop: "extracts",
            redirects: "1",
            pageids: pageId,
        });
        const apiUrl = `${url}?${queryParams.toString()}`;
        try {
            return axios(apiUrl).then((res: any) => {
                return res.data.query.pages[pageId].extract;
            });
        } catch (err) {
            console.error(err);
        }
    };
}

module.exports = getExtractedSummary;
