local question = std.extVar("question");

local template = |||
  You are an EdgeChains assistant.
  Answer the following question in one short paragraph:

  Question: %s
|||;

{
  systemInstruction: "Keep answers concise and factual.",
  prompt: std.format(template, [question]),
}
