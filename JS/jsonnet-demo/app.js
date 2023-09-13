import { Jsonnet } from "@hanazuki/node-jsonnet";
const jsonnet = new Jsonnet();

// Evaluates a simple Jsonnet program into a JSON value
const result = await jsonnet.extString("keepMaxToken","true")
        .extString("query","")
        .extString("keepContext","true")
        .extString("context","")
        .extString("history","")
        .extString("keepChatHistory","true")
        .extCode("maxToken","100")
        .evaluateFile('./example.jsonnet')
        .then();


export async function parseJsonnet(){
    return JSON.parse(result);
}