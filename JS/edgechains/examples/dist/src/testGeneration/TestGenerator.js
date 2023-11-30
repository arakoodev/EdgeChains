"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getContent = void 0;
const node_jsonnet_1 = require("@hanazuki/node-jsonnet");
const path = require("path");
const OpenAiEndpoint_1 = require("../lib/OpenAiEndpoint");
const jsonnet = new node_jsonnet_1.Jsonnet();
const promptPath = path.join(process.cwd(), './src/testGeneration/prompts.jsonnet');
const testGeneratorPath = path.join(process.cwd(), './src/testGeneration/testGenerator.jsonnet');
const gpt3endpoint = new OpenAiEndpoint_1.OpenAiEndpoint('https://api.openai.com/v1/chat/completions', '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', '', 'gpt-3.5-turbo', 'user', 0.7);
const classText = "@RestResource(urlMapping='/classcontent')\n" +
    "global with sharing class ClassContent \n" +
    "{\n" +
    "    @HttpPost\n" +
    "    global static String getClassInfo(String className) \n" +
    "    {\n" +
    "        String classContent = [SELECT Body \n" +
    "                               FROM ApexClass \n" +
    "                               WHERE Name = :className LIMIT 1].Body;\n" +
    "\n" +
    "        return classContent;\n" +
    "    }\n" +
    "}";
async function getContent() {
    try {
        var prompt = await jsonnet.evaluateFile(promptPath);
        const testPrompt = await jsonnet.extString('promptTemplate', JSON.parse(prompt).prompt)
            .extString('test_class', classText)
            .extString('test_package', 'Apex')
            .evaluateFile(testGeneratorPath);
        const initialResponse = await gpt3endpoint.gptFnTestGenerator(JSON.parse(prompt).promptStart);
        console.log('Initial Response.....\n\n' + initialResponse);
        var responce = await gpt3endpoint.gptFnTestGenerator(initialResponse + JSON.parse(testPrompt).prompt);
        console.log('First Response.......\n \n' + responce);
        var finalResponse = responce;
        responce += JSON.parse(prompt).promptPlan;
        finalResponse += await gpt3endpoint.gptFnTestGenerator(responce);
        console.log('Final Response.......\n\n' + finalResponse);
        const codeBlocks = extractCodeBlocks(finalResponse);
        console.log(codeBlocks);
        responce = await gpt3endpoint.gptFnTestGenerator(JSON.parse(prompt).textConversion + '\n\n' + codeBlocks[0]);
        console.log(responce);
    }
    catch (error) {
        console.log(error);
    }
}
exports.getContent = getContent;
function extractCodeBlocks(text) {
    const codeBlockRegex = /```(?:apex)\s*([\s\S]+?)\s*```/g;
    const codeBlocks = [];
    let match;
    while ((match = codeBlockRegex.exec(text)) !== null) {
        codeBlocks.push(match[1]);
    }
    return codeBlocks;
}
//# sourceMappingURL=TestGenerator.js.map