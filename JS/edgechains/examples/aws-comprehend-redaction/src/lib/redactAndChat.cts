const { AWSComprehend, OpenAI } = require("@arakoodev/edgechains.js/ai");

async function redactAndChat({
    prompt,
    openAIApiKey,
    awsAccessKeyId,
    awsSecretAccessKey,
    awsRegion,
}: any) {
    const comprehend = new AWSComprehend({
        region: awsRegion || "us-east-1",
        accessKeyId: awsAccessKeyId,
        secretAccessKey: awsSecretAccessKey,
        redactionMode: "REPLACE_WITH_PII_ENTITY_TYPE",
    });

    const openai = new OpenAI({ apiKey: openAIApiKey });

    // Chain AWSComprehend observable redaction directly into the OpenAI endpoint
    const redactionResult = await comprehend.observe(prompt).toPromise();
    const llmResponse = await comprehend
        .redactObservable(prompt)
        .chain(openai, { model: "gpt-3.5-turbo" })
        .toPromise();

    return JSON.stringify({
        redactedPrompt: redactionResult.redactedText,
        detectedEntities: redactionResult.entities,
        reply: llmResponse,
    });
}

module.exports = redactAndChat;
