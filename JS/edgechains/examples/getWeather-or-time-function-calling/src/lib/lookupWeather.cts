const axios = require("axios");
const path = require("path");
const Jsonnet = require("@arakoodev/jsonnet");
const jsonnet = new Jsonnet();

const secretsPath = path.join(__dirname, "../../jsonnet/secrets.jsonnet");
const rapidAPI_Key = JSON.parse(jsonnet.evaluateFile(secretsPath)).rapid_api_key;

function lookupWeather() {
    return (location: string) => {
        const options = {
            url: "https://weatherapi-com.p.rapidapi.com/forecast.json",
            params: {
                q: location,
                days: "3",
            },
            headers: {
                "X-RapidAPI-Key": rapidAPI_Key,
                "  X-RapidAPI-Host": "weatherapi-com.p.rapidapi.com",
            },
        };
        try {
            const response = axios
                .request(options)
                .then((response: any) => {
                    const weather = response.data;
                    const weatherForecast = `Location: ${weather.location.name} \
                                        Current Temperature: ${weather.current.temp_c} \
                                        Condition: ${weather.current.condition.text}. \
                                        Low Today: ${weather.forecast.forecastday[0].day.mintemp_c} \
                                        High Today: ${weather.forecast.forecastday[0].day.maxtemp_c}`;
                    return weatherForecast;
                })
                .catch((error: any) => {
                    console.error(error);
                });
            return response;
        } catch (error) {
            console.error(error);
            return "No forecast found";
        }
    };
}

module.exports = lookupWeather;
