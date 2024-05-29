"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const axios = require('axios');
function lookupWeather() {
    return ((location) => {
        const options = {
            method: 'GET',
            url: 'https://weatherapi-com.p.rapidapi.com/forecast.json',
            params: {
                q: location,
                days: '3'
            },
            headers: {
                'X-RapidAPI-Key': "e8c7527ecdmshdd2b467ed60092cp1803cfjsn2a4dcb102fc4",
                '  X-RapidAPI-Host': 'weatherapi-com.p.rapidapi.com'
            }
        };
        try {
            const response = axios.request(options).then((response) => {
                return response;
            }).catch((error) => {
                console.error(error);
            });
            let weather = response.data;
            const weatherForecast = `Location: ${weather.location.name} \
          Current Temperature: ${weather.current.temp_c} \
          Condition: ${weather.current.condition.text}. \
          Low Today: ${weather.forecast.forecastday[0].day.mintemp_c} \
          High Today: ${weather.forecast.forecastday[0].day.maxtemp_c}`;
            return weatherForecast;
        }
        catch (error) {
            console.error(error);
            return "No forecast found";
        }
    });
}
module.exports = lookupWeather;
