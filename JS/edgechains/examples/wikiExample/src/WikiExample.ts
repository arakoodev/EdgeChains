import { OpenAiEndpoint } from "@arakoodev/edgechains.js";
import * as path from "path";
import { Hono } from "hono";
import axios from "axios";

const getJsonnet = async () => {
    let jsonnet = await import("@arakoodev/jsonnet");
    return jsonnet.default;
};

export const WikiRouter = new Hono();

WikiRouter.post("/wiki-summary", async (c) => {
    const query = await c.req.json();
    const summary = await wikiSummary(query.input);

    return c.json({ message: summary }, 200);
});

const wikiJsonnetPath = path.join(__dirname, "../src/wiki.jsonnet");

const gpt3endpoint = new OpenAiEndpoint(
    "https://api.openai.com/v1/chat/completions",
    process.env.OPENAI_API_KEY!,
    "",
    "gpt-3.5-turbo",
    "user",
    parseInt("0.7")
);

export async function wikiSummary(input: string) {
    const Jsonnet = await getJsonnet();
    const jsonnet = new Jsonnet();
    const wikiResponse = await axios
        .post(
            "https://en.wikipedia.org/w/api.php",
            {},
            {
                params: {
                    action: "query",
                    prop: "extracts",
                    format: "json",
                    titles: input,
                    explaintext: "",
                },
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                    Accept: "application/json",
                },
            }
        )
        .then(function (response) {
            return Object.values(response.data.query.pages);
        })
        .catch(function (error) {
            if (error.response) {
                console.log("Server responded with status code:", error.response.status);
                console.log("Response data:", error.response.data);
            } else if (error.request) {
                console.log("No response received:", error.request);
            } else {
                console.log("Error creating request:", error.message);
            }
        });

    const wikiJsonnet = await jsonnet
        .extString("keepMaxTokens", "true")
        .extString("maxTokens", "4096")
        .extString("keepContext", "true")
        .extString("context", wikiResponse[0].extract)
        .evaluateFile(wikiJsonnetPath);

    const gpt3Response = await gpt3endpoint.gptFn(JSON.parse(wikiJsonnet).prompt);

    console.log("Summary from GPT: \n\n\n" + gpt3Response);

    return gpt3Response;
}
