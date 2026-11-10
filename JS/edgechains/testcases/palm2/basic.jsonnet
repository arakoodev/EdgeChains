local promptTemplate = |||
  You are a helpful assistant.
  Answer this question clearly: {question}
|||;

{
  model: "gemini-pro",
  prompt: std.strReplace(promptTemplate, "{question}", std.extVar("question")),
  max_output_tokens: 128,
  temperature: 0.2,
}
