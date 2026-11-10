local promptTemplate = |||
  You are a helpful assistant powered by Google Gemini.
  Answer the following question concisely and accurately: {question}
|||;

local key = std.extVar('gemini_api_key');
local UserQuestion = std.extVar('question');

local promptWithQuestion = std.strReplace(promptTemplate, '{question}', UserQuestion + '\n');

local main() =
  local response = arakoo.native('geminiCall')({ prompt: promptWithQuestion, geminiApiKey: key });
  response;

main()
