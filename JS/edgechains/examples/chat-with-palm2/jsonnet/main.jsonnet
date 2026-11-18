local promptTemplate = |||
  You are a helpful assistant powered by Google Palm2.
  Answer the following question: {question}
|||;


local key = std.extVar('palm2_api_key');
local UserQuestion = std.extVar('question');

local promptWithQuestion = std.strReplace(promptTemplate, '{question}', UserQuestion + '\n');

local main() =
  local response = arakoo.native('palm2Call')({
    prompt: promptWithQuestion,
    palm2ApiKey: key,
    model: 'chat-bison-001',
    temperature: 0.7,
  });
  response;

main()
