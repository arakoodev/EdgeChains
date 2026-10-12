local promptTemplate = |||
  You are a helpful assistant. Answer the following question clearly:
  {question}
|||;

local question = std.extVar("question");

{
  prompt: std.strReplace(promptTemplate, "{question}", question + "\n"),
}
