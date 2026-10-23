const { OpenAI, AwsComprehendRedactor } = require("@arakoodev/edgechains.js/ai");

async function redactAndChatCall({
    prompt,
    openAIApiKey,
    awsAccessKeyId,
    awsSecretAccessKey,
    awsRegion,
    maskMode,
}: any) {
    try {
        const redactor = new AwsComprehendRedactor({
            region: awsRegion || "us-east-1",
            accessKeyId: awsAccessKeyId,
            secretAccessKey: awsSecretAccessKey,
            maskMode: maskMode || "REPLACE_WITH_PII_ENTITY_TYPE",
        });

        const openai = new OpenAI({ apiKey: openAIApiKey });
        const redactionPreview = await redactor.redactText(prompt);

        const response = await new Promise((resolve, reject) => {
            openai
                .chainRedactor(redactor)
                .observeChat({ prompt })
                .subscribe({
                    next: (value: any) => resolve(value),
                    error: (err: any) => reject(err),
                });
        });

        return JSON.stringify({
            redactedPrompt: redactionPreview.redactedText,
            detectedEntities: redactionPreview.entities,
            llmResponse: response,
        });
    } catch (error: any) {
        return JSON.stringify({ error: error?.message || String(error) });
    }
}

module.exports = redactAndChatCall;
