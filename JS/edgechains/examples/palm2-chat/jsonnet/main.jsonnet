local promptTemplate = |||
  You are a helpful assistant.
  Answer the user's question in one short paragraph.

  Question: {question}
|||;

local question = std.extVar('question');

{
  model: 'gemini-pro',
  prompt: std.strReplace(promptTemplate, '{question}', question),
  temperature: 0.2,
  max_output_tokens: 256,
  responseType: 'text/plain',
}
