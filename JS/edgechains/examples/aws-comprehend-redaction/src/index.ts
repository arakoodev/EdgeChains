import { ComprehendRedactor, OpenAI } from "@arakoodev/edgechains.js/ai";

async function main() {
  const redactor = new ComprehendRedactor();
  const prompt =
    "Summarize this customer note: Jane Doe can be reached at jane@example.com.";
  const redactedPrompt = await redactor.redactText(prompt);

  console.log("Redacted prompt:", redactedPrompt);

  if (!process.env.OPENAI_API_KEY) {
    console.log("Skipping OpenAI call because OPENAI_API_KEY is not set.");
    return;
  }

  const openAI = new OpenAI({});
  const safeOpenAI = redactor.wrapChat(openAI);
  const response = await safeOpenAI.chat({ prompt });

  console.log(response);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
