local promptTemplate = |||
  You are a concise assistant.
  Answer the following question in one sentence:
  {question}
|||;

local question = std.extVar("question");

{
  model: "gemini-2.0-flash",
  prompt: std.strReplace(promptTemplate, "{question}", question),
  generationConfig: {
    temperature: 0.2,
    maxOutputTokens: 128,
    responseMimeType: "text/plain",
  },
}
