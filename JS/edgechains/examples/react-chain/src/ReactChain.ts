import { Jsonnet } from "@hanazuki/node-jsonnet";
import { OpenAiEndpoint } from "@arakoodev/edgechains.js";
import * as path from "path";
import { Hono } from "hono";
import axios from "axios";

const jsonnet = new Jsonnet();

jsonnet.nativeCallback("udf.fn",async (prompt) => {

    const wikiResponse = await axios
        .post(
            "https://en.wikipedia.org/w/api.php",
            {},
            {
                params: {
                    action: "query",
                    prop: "extracts",
                    format: "json",
                    titles: prompt,
                    explaintext: "",
                },
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                    Accept: "application/json",
                },
            }
        )
        .then(function (response) {
            
            if(response.data.query == undefined)
                return "";
            else
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

    if(wikiResponse == ""){
        return ""
    }
    else{
        if(wikiResponse[0].extract == undefined){
            return "";
        }
        return wikiResponse[0].extract;
    } 

},"prompt")

export const ReactChainRouter = new Hono();

const gpt3Endpoint = new OpenAiEndpoint(
    "https://api.openai.com/v1/chat/completions",
    process.env.OPENAI_API_KEY!,
    "",
    "gpt-3.5-turbo",
    "user",
    parseInt("0.7")
);

const reactChainJsonnetPath = path.join(__dirname, "../src/react-chain.jsonnet");

ReactChainRouter.post("/react-chain", async (c) => {
    const query = await c.req.json();
    const reactResponse = await reactChain(query.prompt);

    return c.json({ answer : reactResponse }, 200);
});

export async function reactChain(query) {


    var reactJsonnet = await jsonnet
                                .extString("gptResponse","")
                                .extString("context","This is contenxt")
                                .evaluateFile(reactChainJsonnetPath);

    var context = "";

    var preset = JSON.parse(reactJsonnet).preset;

    query = preset + "\nQuestion: " + query;

    var gptResponse = await gpt3Endpoint.gptFn(query);

    console.log(gptResponse);

    context = context + query;

    jsonnet.extString("context",context).extString("gptResponse",gptResponse);

    while(!checkIfFinished(gptResponse)){

        reactJsonnet = await jsonnet.evaluateFile(reactChainJsonnetPath);
        query = JSON.parse(reactJsonnet).prompt;

        gptResponse = await gpt3Endpoint.gptFn(query);

        console.log(gptResponse);

        context += "\n" + query;
        jsonnet.extString("context",context).extString("gptResponse",gptResponse);
    }

    console.log(gptResponse);

    var res = gptResponse.substring(gptResponse.indexOf("Finish["))
    return res.substring(res.indexOf("[")+1,res.indexOf("]"));
}

function checkIfFinished(response:string){
    return response.includes("Finish");
}