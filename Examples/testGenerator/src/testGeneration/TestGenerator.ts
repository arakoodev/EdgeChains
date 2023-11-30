import { Jsonnet } from "@hanazuki/node-jsonnet";
import * as path from "path";
import { OpenAiEndpoint } from "@arakoodev/edgechains.js";
import { Hono } from "hono";
import { type } from "os";

const jsonnet = new Jsonnet();
const promptPath = path.join(__dirname, "../src/testGeneration/prompts.jsonnet");
const testGeneratorPath = path.join(__dirname, "../src/testGeneration/testGenerator.jsonnet");


export const testGenratorRouter = new Hono();

testGenratorRouter.post("/generate",async (c) => {

    const query = await c.req.json();
    const classText : string = query.test_class

    const content = await getContent(classText.toString());

    return c.json({message:content},200);
} )


const gpt3endpoint = new OpenAiEndpoint(
    "https://api.openai.com/v1/chat/completions",
    process.env.OPENAI_API_KEY!,
    process.env.OPENAI_ORG_ID!,
    "gpt-3.5-turbo",
    "user",
    0.7
);

export async function getContent(classText:string){
    try{
        console.log('in get content')
        var prompt = await jsonnet.evaluateFile(promptPath);

        const testPrompt = await jsonnet.extString('promptTemplate',JSON.parse(prompt).prompt)
                                        .extString('test_class',classText)
                                        .extString('test_package','Apex')
                                        .evaluateFile(testGeneratorPath);

        const initialResponse = await gpt3endpoint.gptFnTestGenerator(JSON.parse(prompt).promptStart);

        console.log('Initial Response.....\n\n'+initialResponse);

        var responce = await gpt3endpoint.gptFnTestGenerator(initialResponse+JSON.parse(testPrompt).prompt);
        
        console.log('First Response.......\n \n'+responce);
        var finalResponse = responce;

        responce += JSON.parse(prompt).promptPlan;

        finalResponse += await gpt3endpoint.gptFnTestGenerator(responce);
        
        console.log('Final Response.......\n\n'+finalResponse);

        const codeBlocks = extractCodeBlocks(finalResponse);
        responce = await gpt3endpoint.gptFnTestGenerator(JSON.parse(prompt).textConversion+'\n\n'+codeBlocks[0]);
        console.log(responce);

       return extractCodeBlocks(responce);
    }catch(error){
        console.log(error);
    }
}

function extractCodeBlocks(text: string): string[] {
    const codeBlockRegex = /```(?:apex)\s*([\s\S]+?)\s*```/g;
    const codeBlocks: string[] = [];
    let match;
  
    while ((match = codeBlockRegex.exec(text)) !== null) {
      codeBlocks.push(match[1]);
    }
  
    return codeBlocks;
  }



