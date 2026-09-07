local promptTemplate = |||
  You are a helpful assistant. Answer the question using only the provided text.
  Do not ask the user to repeat any redacted values.
  Question: {question}
|||;

local openaiKey = std.extVar('openai_api_key');
local awsRegion = std.extVar('aws_region');
local awsAccessKeyId = std.extVar('aws_access_key_id');
local awsSecretAccessKey = std.extVar('aws_secret_access_key');
local demo = std.extVar('comprehend_demo');
local UserQuestion = std.extVar('question');

local promptWithQuestion = std.strReplace(promptTemplate, '{question}', UserQuestion + '\n');

local main() =
  local redacted = arakoo.native('redactPii')({
    text: promptWithQuestion,
    awsRegion: awsRegion,
    awsAccessKeyId: awsAccessKeyId,
    awsSecretAccessKey: awsSecretAccessKey,
    demo: demo,
  });
  local response = arakoo.native('openAICall')({ prompt: redacted, openAIApiKey: openaiKey });
  {
    redactedPrompt: redacted,
    response: response,
  };

main()
