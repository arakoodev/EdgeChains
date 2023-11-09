import { Jsonnet } from "@hanazuki/node-jsonnet";
import * as path from 'path';

const jsonnet = new Jsonnet();
const promptPath = path.join(process.cwd(),'./src/testGeneration/prompts.jsonnet')

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
                  "    return \"ChatMessage{\" + \"role='\" + role + \"', content='\" + content + \"'}\";\n" +
                  "  }\n" +
                  "}";
export async function getContent(){
    try{

        var prompt = await jsonnet.extString('testPackage','JUnit')
        .extString('testClass',classText)
        .evaluateFile(promptPath);
        
        console.log(JSON.parse(prompt));
    }catch(error){
        console.log(error);
    }
}