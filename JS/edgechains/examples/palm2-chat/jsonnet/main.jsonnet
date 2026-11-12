local promptTemplate = |||
  You are an expert Google PaLM 2 assistant running within EdgeChains orchestration.
  Answer the following user query with precision and technical depth:
  {question}
|||;

local key = std.extVar('palm2_api_key');
local userQuestion = std.extVar('question');
local promptWithQuestion = std.strReplace(promptTemplate, '{question}', userQuestion + '\n');

local main() =
  local response = arakoo.native('palm2Call')({ prompt: promptWithQuestion, palm2ApiKey: key });
  response;

main()
