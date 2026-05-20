local key = std.extVar('openai_api_key');
local input = std.extVar('input');

local promptTemplate = |||
  Summarize this support request after removing sensitive personal data:
  {input}
|||;

local prompt = std.strReplace(promptTemplate, '{input}', input);

local main() =
  arakoo.native('redactedOpenAICall')({ prompt: prompt, openAIApiKey: key });

main()
