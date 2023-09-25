import { Jsonnet } from "@hanazuki/node-jsonnet";
const jsonnet = new Jsonnet();

// Load Jsonnet to extract args..
const promptLoader = await jsonnet
.evaluateFile("./prompts.jsonnet");

// Getting ${summary} basePrompt
const promptTemplate = JSON.parse(promptLoader).summary;
console.log(promptTemplate)
const hydeLoader = await jsonnet
                        .extString('promptTemplate',promptTemplate)
                        .extString('time',"")
                        .extString('query',"Hello How are You")
                        .evaluateFile("./example.jsonnet");

const prompt = JSON.parse(hydeLoader).prompt;

console.log(prompt);

// Evaluates a simple Jsonnet program into a JSON value
        // await jsonnet
        // // .extString("keepMaxToken","true")
        // // .extString("query","")
        // // .extString("keepContext","true")
        // // .extString("context","")
        // // .extString("history","")
        // // .extString("keepChatHistory","true")
        // // .extCode("maxToken","100")
        // .evaluateFile('./example.jsonnet')
        // .then();

// console.log(JSON.parse(result).summary);

export async function parseJsonnet(){
    return JSON.parse(result);
}