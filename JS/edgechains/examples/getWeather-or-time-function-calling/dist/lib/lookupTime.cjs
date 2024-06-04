"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const axios = require("axios");
const moment = require("moment-timezone");
function lookupTime() {
    return (location) => {
        try {
            const response = axios
                .get(`http://worldtimeapi.org/api/timezone/${location}`)
                .then((response) => {
                const { datetime } = response.data;
                const dateTime = moment.tz(datetime, location).format("h:mmA");
                const timeResponse = `The current time in ${location} is ${dateTime}.`;
                return timeResponse;
            })
                .catch((error) => {
                console.error(error);
            });
            return response;
        }
        catch (error) {
            console.error(error);
        }
    };
}
module.exports = lookupTime;
