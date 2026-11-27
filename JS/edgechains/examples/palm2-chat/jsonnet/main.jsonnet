local promptTemplate = |||
  You are a helpful assistant. Answer the following question concisely: {question}
|||;

local Question = std.extVar('question');

local promptWithQuestion = std.strReplace(promptTemplate, '{question}', Question + '\n');

{
    prompt: promptWithQuestion,
}
