import axios from "axios";

function apiCall() {
    return (config: any) => {
        const response = axios
            .request(config)
            .then((response: any) => {
                return JSON.stringify(response.data);
            })
            .catch((error: any) => {
                console.error(error);
            });
        return response;
    };
}

module.exports = apiCall;
