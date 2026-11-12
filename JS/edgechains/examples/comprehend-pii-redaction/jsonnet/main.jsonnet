local promptTemplate = |||
  You are a customer support assistant. Summarize the customer's inquiry safely after PII redaction:
  {transcript}
|||;

local openaiKey = std.extVar('openai_api_key');
local awsAccessKeyId = std.extVar('aws_access_key_id');
local awsSecretAccessKey = std.extVar('aws_secret_access_key');
local awsRegion = std.extVar('aws_region');
local transcript = std.extVar('transcript');

local promptWithTranscript = std.strReplace(promptTemplate, '{transcript}', transcript + '\n');

local main() =
  local response = arakoo.native('redactAndChatCall')({
    prompt: promptWithTranscript,
    openAIApiKey: openaiKey,
    awsAccessKeyId: awsAccessKeyId,
    awsSecretAccessKey: awsSecretAccessKey,
    awsRegion: awsRegion,
  });
  response;

main()
