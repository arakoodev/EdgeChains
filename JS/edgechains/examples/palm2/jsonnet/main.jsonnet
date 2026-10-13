local promptTemplate = |||
  You are a helpful assistant.
  Answer the following question: {question}
|||;

local key = std.extVar('palm_api_key');
local userQuestion = std.extVar('question');

local promptWithQuestion = std.strReplace(promptTemplate, '{question}', userQuestion + '\n');

local main() =
  local response = arakoo.native('palm2Call')({
    prompt: promptWithQuestion,
    palmApiKey: key,
    temperature: 0.7,
    maxOutputTokens: 256
  });
  response;

main()
