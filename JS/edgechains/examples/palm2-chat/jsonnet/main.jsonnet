local promptTemplate = |||
  You are an expert AI assistant powered by Google PaLM2 / Gemini in EdgeChains.
  Answer the following question clearly and concisely: {question}
|||;

local key = std.extVar("palm2_api_key");
local UserQuestion = std.extVar("question");

local promptWithQuestion = std.strReplace(promptTemplate, "{question}", UserQuestion);

local main() = {
  model: "text-bison-001",
  prompt: promptWithQuestion,
  temperature: 0.2,
  maxOutputTokens: 512,
  apiKey: key,
};

main()
