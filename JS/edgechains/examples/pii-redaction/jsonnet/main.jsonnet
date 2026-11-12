local promptTemplate = |||
  You are a helpful assistant that can answer questions based on given question 
  Answer the following question: {question}
|||;


local key = std.extVar('openai_api_key');
local UserQuestion = std.extVar('question');

local promptWithQuestion = std.strReplace(promptTemplate, '{question}', UserQuestion + '\n');

local main() =
  local response = arakoo.native('openAICall')({ prompt: promptWithQuestion, openAIApiKey: key });
  response;

main()
