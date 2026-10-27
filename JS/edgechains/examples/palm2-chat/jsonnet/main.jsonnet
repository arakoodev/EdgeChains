local promptTemplate = |||
  You are a helpful assistant that answers clearly and concisely.
  Answer the following question: {question}
|||;

local key = std.extVar('palm2_api_key');
local question = std.extVar('question');

local prompt = std.strReplace(promptTemplate, '{question}', question + '\n');

local main() =
  arakoo.native('palm2Call')({ prompt: prompt, palm2ApiKey: key });

main()
