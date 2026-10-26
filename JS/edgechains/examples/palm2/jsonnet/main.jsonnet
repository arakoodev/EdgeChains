local promptTemplate = |||
  You are a helpful assistant powered by Google PaLM 2 and EdgeChains Jsonnet.
  Answer the following question clearly: {question}
|||;

local key = std.extVar('palm2_api_key');
local userQuestion = std.extVar('question');

local promptWithQuestion = std.strReplace(promptTemplate, '{question}', userQuestion + '\n');

local main() =
  local response = arakoo.native('palm2Call')({
    prompt: promptWithQuestion,
    palm2ApiKey: key,
  });
  response;

main()
