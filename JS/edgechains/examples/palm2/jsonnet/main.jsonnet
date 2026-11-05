local promptTemplate = |||
  You are a helpful assistant. Answer the following question concisely and accurately.
  Question: {question}
|||;

local key = std.extVar('palm2_api_key');
local UserQuestion = std.extVar('question');

local promptWithQuestion = std.strReplace(promptTemplate, '{question}', UserQuestion);

{
    "apiKey": key,
    "model": "chat-bison-001",
    "prompt": promptWithQuestion,
    "temperature": 0.25,
    "maxOutputTokens": 512,
    "candidateCount": 1,
    "topK": 40,
    "topP": 0.95,
}
