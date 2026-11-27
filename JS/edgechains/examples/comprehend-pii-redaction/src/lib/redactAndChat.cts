const { OpenAI, AWSComprehend, PiiObservable } = require("@arakoodev/edgechains.js/ai");

async function redactAndChatCall({
    prompt,
    openAIApiKey,
    awsRegion,
    awsAccessKeyId,
    awsSecretAccessKey,
}: any) {
    try {
        const comprehend = new AWSComprehend({
            region: awsRegion || "us-east-1",
            accessKeyId: awsAccessKeyId,
            secretAccessKey: awsSecretAccessKey,
            maskMode: "REPLACE_WITH_PII_ENTITY_TYPE",
        });

        const openai = new OpenAI({ apiKey: openAIApiKey });

        // Chain AWS Comprehend PII redaction as an Observable pipeline with the OpenAI Endpoint
        const result = await PiiObservable.of(prompt)
            .pipe(comprehend.asOperator())
            .switchMap(async (redactedPrompt: string) => {
                const aiMessage = await openai.chat({ prompt: redactedPrompt });
                return {
                    redactedPrompt,
                    answer: aiMessage?.content || aiMessage,
                };
            })
            .toPromise();

        return JSON.stringify(result);
    } catch (error: any) {
        return JSON.stringify({ error: error?.message || String(error) });
    }
}

module.exports = redactAndChatCall;
