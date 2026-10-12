{
  prompt: |||
    You are a helpful assistant.
    Answer the user's question in one short paragraph.

    Question: {question}
  |||,
  question: "What is EdgeChains?",
  model: "gemini-pro",
  temperature: 0.2,
  max_output_tokens: 256,
  responseType: "text/plain",
}
