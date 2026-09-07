const { AWSComprehend } = require("@arakoodev/edgechains.js/ai");
const { createDemoComprehendClient } = require("./demoComprehendClient.cjs");

function isPlaceholder(value?: string) {
    return !value || /your-|^\*+$|\*\*\*/i.test(value);
}

async function redactPii({
    text,
    awsRegion,
    awsAccessKeyId,
    awsSecretAccessKey,
    demo,
}: {
    text: string;
    awsRegion?: string;
    awsAccessKeyId?: string;
    awsSecretAccessKey?: string;
    demo?: string;
}) {
    try {
        const useDemo = demo === "1" || isPlaceholder(awsAccessKeyId) || isPlaceholder(awsSecretAccessKey);
        const comprehend = new AWSComprehend({
            region: awsRegion || "us-east-1",
            accessKeyId: useDemo ? undefined : awsAccessKeyId,
            secretAccessKey: useDemo ? undefined : awsSecretAccessKey,
            client: useDemo ? createDemoComprehendClient() : undefined,
        });
        return await comprehend.redactPrompt(text);
    } catch (error: any) {
        return { error: error?.message || String(error) };
    }
}

module.exports = redactPii;
