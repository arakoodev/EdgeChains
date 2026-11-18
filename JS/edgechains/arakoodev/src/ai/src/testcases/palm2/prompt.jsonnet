local promptTemplate = |||
  You are an expert assistant powered by Google PaLM 2.
  Question: {question}
|||;

local question = std.extVar('question');
local resolvedPrompt = std.strReplace(promptTemplate, '{question}', question);

{
  prompt: std.stripChars(resolvedPrompt, ' \n\t'),
  context: 'Answer concisely and accurately.',
  embeddingText: 'EdgeChains PaLM 2 embedding vector test'
}
