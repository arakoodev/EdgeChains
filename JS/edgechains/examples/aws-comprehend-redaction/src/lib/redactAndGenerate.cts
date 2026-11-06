const { AwsComprehendRedact, OpenAI } = require("@arakoodev/edgechains.js/ai");

async function redactPrompt({
    prompt,
    accessKeyId,
    secretAccessKey,
    region,
}: {
    prompt: string;
    accessKeyId: string;
    secretAccessKey: string;
    region?: string;
}) {
    const redactor = new AwsComprehendRedact({
        accessKeyId,
        secretAccessKey,
        region: region || "us-east-1",
        redactionMode: "ENTITY_TYPE",
    });
    return await redactor.observe(prompt).toPromise();
}

async function openAIChatWithRedaction({
    prompt,
    accessKeyId,
    secretAccessKey,
    region,
    openaiApiKey,
}: {
    prompt: string;
    accessKeyId: string;
    secretAccessKey: string;
    region?: string;
    openaiApiKey: string;
}) {
    const redactor = new AwsComprehendRedact({
        accessKeyId,
        secretAccessKey,
        region: region || "us-east-1",
        redactionMode: "ENTITY_TYPE",
    });
    const openai = new OpenAI({ apiKey: openaiApiKey });

    const res = await redactor
        .observe(prompt)
        .chain(openai, { model: "gpt-3.5-turbo", temperature: 0 })
        .toPromise();

    return res?.content || "";
}

module.exports = {
    redactPrompt,
    openAIChatWithRedaction,
};
