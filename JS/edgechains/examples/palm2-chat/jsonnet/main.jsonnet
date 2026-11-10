local promptTemplate = |||
  You are a concise assistant.
  Answer the following question in one sentence:
  {question}
|||;

local key = std.extVar("gemini_api_key");
local question = std.extVar("question");
local prompt = std.strReplace(promptTemplate, "{question}", question + "\n");

local main() =
  arakoo.native("geminiCall")({
    prompt: prompt,
    geminiApiKey: key,
    model: "gemini-2.0-flash",
    maxOutputTokens: 128,
    temperature: 0.2,
  });

main()
