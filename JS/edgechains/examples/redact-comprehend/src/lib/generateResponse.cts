const { OpenAI, AWSComprehend, RedactComprehend } = require("@arakoodev/edgechains.js/ai");

async function redactCall({ prompt, openAIApiKey, awsAccessKeyId, awsSecretAccessKey }: any) {
    try {
        const openai = new OpenAI({ apiKey: openAIApiKey });
        const comprehend = new AWSComprehend({ accessKeyId: awsAccessKeyId, secretAccessKey: awsSecretAccessKey });
        const redactor = new RedactComprehend(openai, comprehend);
        let res = await redactor.chat({ prompt });
        return JSON.stringify(res);
    } catch (error) {
        return error;
    }
}

module.exports = redactCall;
