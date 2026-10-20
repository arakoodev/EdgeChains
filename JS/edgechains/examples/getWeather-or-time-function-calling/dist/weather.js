var _a, _b, _c;
import readlineSync from "readline-sync";
import axios from "axios";
import moment from "moment-timezone";
import { OpenAI } from "arakoodev/openai";
const openai = new OpenAI({
    apiKey: "sk-proj-wOByN9rS9LorcpZlyjhYT3BlbkFJYq5aMCDtdXY5MMISVuze",
});
async function lookupTime(location) {
    try {
        const response = await axios.get(`http://worldtimeapi.org/api/timezone/${location}`);
        const { datetime } = response.data;
        const dateTime = moment.tz(datetime, location).format("h:mmA");
        const timeResponse = `The current time in ${location} is ${dateTime}.`;
        return timeResponse;
    } catch (error) {
        console.error(error);
    }
}
async function lookupWeather(location) {
    const options = {
        method: "GET",
        url: "https://weatherapi-com.p.rapidapi.com/forecast.json",
        params: {
            q: location,
            days: "3",
        },
        headers: {
            "X-RapidAPI-Key": "e8c7527ecdmshdd2b467ed60092cp1803cfjsn2a4dcb102fc4",
            "  X-RapidAPI-Host": "weatherapi-com.p.rapidapi.com",
        },
    };
    try {
        const response = await axios.request(options);
        let weather = response.data;
        const weatherForecast = `Location: ${weather.location.name} \
    Current Temperature: ${weather.current.temp_c} \
    Condition: ${weather.current.condition.text}. \
    Low Today: ${weather.forecast.forecastday[0].day.mintemp_c} \
    High Today: ${weather.forecast.forecastday[0].day.maxtemp_c}`;
        console.log({ weatherForecast });
        return weatherForecast;
    } catch (error) {
        console.error(error);
        return "No forecast found";
    }
}
const user_input = readlineSync.question("Your input: ");
const functions = [
    {
        name: "lookupTime",
        description: "get the current time in a given location",
        parameters: {
            type: "object", // specify that the parameter is an object
            properties: {
                location: {
                    type: "string", // specify the parameter type as a string
                    description:
                        "The location, e.g. Beijing, China. But it should be written in a timezone name like Asia/Shanghai",
                },
            },
            required: ["location"], // specify that the location parameter is required
        },
    },
    {
        name: "lookupWeather",
        description: "get the weather forecast in a given location",
        parameters: {
            type: "object", // specify that the parameter is an object
            properties: {
                location: {
                    type: "string", // specify the parameter type as a string
                    description:
                        "The location, e.g. Beijing, China. But it should be written in a city, state, country",
                },
            },
            required: ["location"], // specify that the location parameter is required
        },
    },
];
try {
    const completion = await openai.chatWithFunction({
        model: "gpt-3.5-turbo-0613",
        messages: [{ role: "user", content: user_input }],
        functions,
        function_call: "auto",
    });
    const completionResponse = completion;
    if (!completionResponse.content) {
        const functionCallName =
            (_a =
                completionResponse === null || completionResponse === void 0
                    ? void 0
                    : completionResponse.function_call) === null || _a === void 0
                ? void 0
                : _a.name;
        if (functionCallName === "lookupTime") {
            const completionArguments = JSON.parse(
                (_b =
                    completionResponse === null || completionResponse === void 0
                        ? void 0
                        : completionResponse.function_call) === null || _b === void 0
                    ? void 0
                    : _b.arguments
            );
            const completion_text = await lookupTime(completionArguments.location);
            console.log(completion_text);
        } else if (functionCallName === "lookupWeather") {
            const completionArguments = JSON.parse(
                (_c =
                    completionResponse === null || completionResponse === void 0
                        ? void 0
                        : completionResponse.function_call) === null || _c === void 0
                    ? void 0
                    : _c.arguments
            );
            const completion_text = await lookupWeather(completionArguments.location);
            try {
                const completion = await openai.chat({
                    model: "gpt-3.5-turbo-0613",
                    messages: [
                        {
                            role: "user",
                            content: "Summarize the following input." + completion_text,
                        },
                    ],
                });
                const completionResponse = completion.content;
                console.log(completionResponse);
            } catch (error) {
                console.log(error);
            }
        }
    } else {
        const completion_text = completion.content;
        console.log(completion_text);
    }
} catch (error) {
    console.error(error);
}
