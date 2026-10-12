local promptTemplate = |||
You are a concise developer assistant.

Question:
{question}
|||;

local question = std.extVar('question');
local prompt = std.strReplace(promptTemplate, '{question}', question);

{
  model: 'gemini-pro',
  prompt: prompt,
  temperature: 0.2,
  maxOutputTokens: 256,
}
