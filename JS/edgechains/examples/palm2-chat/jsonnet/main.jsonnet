local promptTemplate = |||
  You are an expert Google PaLM 2 assistant running within EdgeChains orchestration.
  Answer the following user query with precision and technical depth:
  {question}
|||;

local userQuestion = std.extVar('question');
local promptWithQuestion = std.strReplace(promptTemplate, '{question}', userQuestion + '\n');

promptWithQuestion
