local promptTemplate = |||
  You are a privacy-safe customer support assistant.
  Respond to the following redacted customer inquiry without asking for raw PII:
  {question}
|||;

local openaiKey = std.extVar('openai_api_key');
local awsRegion = std.extVar('aws_region');
local awsAccessKeyId = std.extVar('aws_access_key_id');
local awsSecretAccessKey = std.extVar('aws_secret_access_key');
local userQuestion = std.extVar('question');

local promptWithQuestion = std.strReplace(promptTemplate, '{question}', userQuestion + '\n');

local main() =
  local response = arakoo.native('redactAndChatCall')({
    prompt: promptWithQuestion,
    openAIApiKey: openaiKey,
    awsRegion: awsRegion,
    awsAccessKeyId: awsAccessKeyId,
    awsSecretAccessKey: awsSecretAccessKey,
  });
  response;

main()
