import axios from "axios";

async function apiCall(config: any) {
    try {
        const response = await axios.request(config);
        return JSON.stringify(response.data);
    } catch (error) {
        console.error(error);
    }
}
module.exports = apiCall;
