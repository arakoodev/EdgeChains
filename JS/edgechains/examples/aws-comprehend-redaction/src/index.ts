import fs from "node:fs";
import { AwsComprehendRedactor, OpenAI } from "@arakoodev/edgechains.js/ai";

const config = JSON.parse(fs.readFileSync("jsonnet/main.jsonnet", "utf8"));

const redactor = new AwsComprehendRedactor({
  region: process.env.AWS_REGION || "us-east-1",
});
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  orgId: process.env.OPENAI_ORG_ID,
});

const response = await redactor.redactEndpointPrompt(openai.chat.bind(openai), {
  prompt: config.prompt,
  model: config.model,
  max_tokens: config.max_tokens,
});

console.log(response);
