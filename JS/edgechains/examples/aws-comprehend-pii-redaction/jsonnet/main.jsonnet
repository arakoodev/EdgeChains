local promptTemplate = |||
  You are a helpful assistant. Answer the question. Do not repeat or store any personal identifiers if they appear in the text.
  Question: {question}
|||;

local UserQuestion = std.extVar('question');
local promptWithQuestion = std.strReplace(promptTemplate, '{question}', UserQuestion + '\n');

{
  prompt: promptWithQuestion,
}
