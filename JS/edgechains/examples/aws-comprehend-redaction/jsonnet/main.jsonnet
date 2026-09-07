local promptTemplate = |||
  You are a helpful assistant. Answer the question using only the provided text.
  Do not ask the user to repeat any redacted values.
  Question: {question}
|||;

local UserQuestion = std.extVar('question');

{
    prompt: std.strReplace(promptTemplate, '{question}', UserQuestion + '\n'),
}
