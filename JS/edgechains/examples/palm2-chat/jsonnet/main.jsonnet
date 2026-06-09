local promptTemplate = |||
  You are a concise assistant. Answer the following question in two short sentences:
  {question}
|||;

local key = std.extVar("palm_api_key");
local userQuestion = std.extVar("question");
local promptWithQuestion = std.strReplace(promptTemplate, "{question}", userQuestion + "\n");

local main() =
  local response = arakoo.native("palm2Call")({ prompt: promptWithQuestion, palmApiKey: key });
  response;

main()
