local promptTemplate = |||
  You are a helpful AI assistant powered by Google PaLM 2.
  Answer the following question concisely and accurately:
  Question: {question}
|||;

local key = std.extVar('palm_api_key');
local userQuestion = std.extVar('question');

local promptWithQuestion = std.strReplace(promptTemplate, '{question}', userQuestion + '\n');

local main() =
  local response = arakoo.native('palm2Call')({
    prompt: promptWithQuestion,
    palmApiKey: key,
    model: 'text-bison-001',
    temperature: 0.4,
  });
  response;

main()
