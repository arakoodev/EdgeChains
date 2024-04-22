import Jsonnet from "@arakoodev/jsonnet";
import * as path from "path";
import { OpenAiEndpoint } from "@arakoodev/edgechains.js";
const jsonnet = new Jsonnet();
const promptPath = path.join(process.cwd(), "./src/testGeneration/prompts.jsonnet");
const testGeneratorPath = path.join(process.cwd(), "./src/testGeneration/testGenerator.jsonnet");
const gpt3endpoint = new OpenAiEndpoint("https://api.openai.com/v1/chat/completions", "", "", "gpt-3.5-turbo", "user", 0.7);
const classText = "public class ChatMessage {\n" +
    "  String role;\n" +
    "  String content;\n\n" +
    "  public ChatMessage(String role, String content) {\n" +
    "    this.role = role;\n" +
    "    this.content = content;\n" +
    "  }\n\n" +
    "  public ChatMessage() {}\n\n" +
    "  public String getRole() {\n" +
    "    return role;\n" +
    "  }\n\n" +
    "  public String getContent() {\n" +
    "    return content;\n" +
    "  }\n\n" +
    "  public void setContent(String content) {\n" +
    "    this.content = content;\n" +
    "  }\n\n" +
    "  @Override\n" +
    "  public String toString() {\n" +
    '    return "ChatMessage{" + "role=\'" + role + "\', content=\'" + content + "\'}";\n' +
    "  }\n" +
    "}";
export async function getContent() {
    try {
        var prompt = await jsonnet.evaluateFile(promptPath);
        const testPrompt = await jsonnet
            .extString("promptTemplate", JSON.parse(prompt).prompt)
            .extString("test_class", classText)
            .extString("test_package", "JUnit")
            .evaluateFile(testGeneratorPath);
        var responce = await gpt3endpoint.gptFnTestGenerator(JSON.parse(testPrompt).prompt);
        console.log("First Response.......\n \n" + responce);
        var finalResponse = responce;
        responce += JSON.parse(prompt).promptPlan;
        finalResponse += await gpt3endpoint.gptFnTestGenerator(responce);
        console.log("Final Response.......\n\n");
        return finalResponse;
    }
    catch (error) {
        console.log(error);
    }
}
