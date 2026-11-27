local promptTemplate = |||
    You are a privacy-aware support assistant. Respond helpfully to the following sanitized customer message without asking for raw PII:
    Customer message: {transcript}
|||;

local openaiKey = std.extVar("openai_api_key");
local awsAccessKeyId = std.extVar("aws_access_key_id");
local awsSecretAccessKey = std.extVar("aws_secret_access_key");
local awsRegion = std.extVar("aws_region");
local transcript = std.extVar("transcript");

local promptWithTranscript = std.strReplace(promptTemplate, "{transcript}", transcript);

local main() =
    local result = arakoo.native("redactAndChat")({
        prompt: promptWithTranscript,
        openAIApiKey: openaiKey,
        awsAccessKeyId: awsAccessKeyId,
        awsSecretAccessKey: awsSecretAccessKey,
        awsRegion: awsRegion,
    });
    result;

main()
