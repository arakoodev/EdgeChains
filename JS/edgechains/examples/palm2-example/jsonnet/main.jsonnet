local promptTemplate = |||
  You are a helpful assistant that can answer questions.
  Answer the following question using PaLM 2: {question}
|||;

local key = std.extVar('palm_api_key');
local UserQuestion = std.extVar('question');

local promptWithQuestion = std.strReplace(promptTemplate, '{question}', UserQuestion + '\n');

local main() =
  local response = arakoo.native('palm2Call')({ prompt: promptWithQuestion, apiKey: key });
  response;

main()
