local promptTemplate = |||
  You are a helpful assistant powered by Google PaLM 2.
  Answer the following question clearly: {question}
|||;

local apiKey = std.extVar('palm_api_key');
local question = std.extVar('question');

local resolvedPrompt = std.strReplace(promptTemplate, '{question}', question);

local main() =
  local response = arakoo.native('palm2Call')({
    prompt: resolvedPrompt,
    apiKey: apiKey,
  });
  response;

main()
