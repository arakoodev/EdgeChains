import { ComprehendPiiRedactor, OpenAI } from "@arakoodev/edgechains.js/ai";

const comprehendClient = {
    async detectPiiEntities(input: { Text: string; LanguageCode: string }) {
        // Replace this object with AWS SDK ComprehendClient usage in production:
        // const client = new ComprehendClient({ region: process.env.AWS_REGION });
        // return client.send(new DetectPiiEntitiesCommand(input));
        const emailStart = input.Text.indexOf("alice@example.com");
        return {
            Entities:
                emailStart >= 0
                    ? [
                          {
                              Type: "EMAIL",
                              BeginOffset: emailStart,
                              EndOffset: emailStart + "alice@example.com".length,
                              Score: 0.99,
                          },
                      ]
                    : [],
        };
    },
};

const redactor = new ComprehendPiiRedactor({ client: comprehendClient });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const safeOpenAi = redactor.wrap(openai);

async function main() {
    const prompt = "Summarize this support ticket from alice@example.com without exposing PII.";
    const redacted = await redactor.redact(prompt);
    console.log(redacted.redactedText);

    if (process.env.OPENAI_API_KEY) {
        const response = await safeOpenAi.chat({ prompt });
        console.log(response);
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
