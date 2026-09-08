import "dotenv/config";
import { OpenAI, ComprehendAI } from "@arakoodev/edgechains.js/ai";

async function main() {
  const comprehend = new ComprehendAI({
    region: process.env.AWS_REGION || "us-east-1",
  });
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const userInput =
    "Hi, I am John Doe. I ordered a laptop to 123 Main Street, Seattle. You can reach me at johndoe@example.com. What is the order status?";

  // Chained with the OpenAI endpoint: the prompt is redacted before the chat call
  const chatOptions = await comprehend.redact({ prompt: userInput });
  console.log("Redacted prompt:", chatOptions.prompt);

  const response = await openai.chat(chatOptions);
  console.log("OpenAI response:", response.content);
}

main().catch(console.error);
