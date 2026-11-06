local REDACTION_PROMPT_TEMPLATE = |||
    You are a privacy-first support specialist. Answer the customer's inquiry below using only the redacted text provided.
    Never ask the customer to re-enter sensitive PII such as SSN, email, or credit card numbers.

    Redacted Customer Inquiry:
    {inquiry}
|||;

local buildPrompt(template, inquiry) =
    std.strReplace(template, '{inquiry}', inquiry);

local rawInquiry = std.extVar("inquiry");
local awsAccessKeyId = std.extVar("aws_access_key_id");
local awsSecretAccessKey = std.extVar("aws_secret_access_key");
local awsRegion = std.extVar("aws_region");
local openaiKey = std.extVar("openai_api_key");

local redactedInquiry = arakoo.native("redactPrompt")({
    prompt: rawInquiry,
    accessKeyId: awsAccessKeyId,
    secretAccessKey: awsSecretAccessKey,
    region: awsRegion,
});

local finalPrompt = buildPrompt(REDACTION_PROMPT_TEMPLATE, redactedInquiry);

local response = arakoo.native("openAIChatWithRedaction")({
    prompt: finalPrompt,
    accessKeyId: awsAccessKeyId,
    secretAccessKey: awsSecretAccessKey,
    region: awsRegion,
    openaiApiKey: openaiKey,
});

{
    redactedPrompt: redactedInquiry,
    answer: response,
}
