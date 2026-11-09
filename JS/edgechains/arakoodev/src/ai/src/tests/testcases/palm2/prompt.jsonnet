local promptTemplate = |||
  You are a concise technical assistant powered by Google PaLM 2.
  Question: {question}
|||;

local question = std.extVar('question');
local model = std.extVar('model');

{
  model: model,
  prompt: std.strReplace(promptTemplate, '{question}', question),
  temperature: 0.3,
  maxOutputTokens: 256,
}
