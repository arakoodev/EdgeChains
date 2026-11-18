local promptTemplate = |||
  You are a helpful assistant.
  Answer the following question with a short reply: {question}
|||;

local key = std.extVar('palm2_api_key');
local UserQuestion = std.extVar('question');

local promptWithQuestion = std.strReplace(promptTemplate, '{question}', UserQuestion + '\n');

local main() =
  local response = arakoo.native('palm2Call')({ prompt: promptWithQuestion, palm2ApiKey: key });
  response;

main()
