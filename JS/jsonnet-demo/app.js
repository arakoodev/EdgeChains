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

const a = [0.0128617634,-0.0071556790580000005,0.01010643056,0.0042276748,-0.0194928978,0.0229963362,-0.0298838202,-0.0011673947880000003]
console.log(JSON.stringify(a))
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