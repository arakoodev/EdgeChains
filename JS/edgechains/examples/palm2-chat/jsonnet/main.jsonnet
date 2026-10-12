local promptTemplate = |||
  You are a concise assistant.
  Answer the question in two short sentences.

  Question: {question}
|||;

local palmApiKey = std.extVar('palm_api_key');
local question = std.extVar('question');
local prompt = std.strReplace(promptTemplate, '{question}', question);

local main() =
  local response = arakoo.native('palm2Call')({
    prompt: prompt,
    palmApiKey: palmApiKey,
  });
  response;

main()
