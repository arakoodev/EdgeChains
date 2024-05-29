const axios = require("axios");
const moment = require("moment-timezone");

function lookupTime() {
    return ((location: string) => {
        try {
            const response = axios.get(`http://worldtimeapi.org/api/timezone/${location}`).then((response: any) => {
                const { datetime } = response.data;
                const dateTime = moment.tz(datetime, location).format("h:mmA");
                const timeResponse = `The current time in ${location} is ${dateTime}.`;
                return timeResponse;
            }).catch((error: any) => {
                console.error(error);
            })

            return response;
        } catch (error) {
            console.error(error);
        }
    })
}

module.exports = lookupTime;