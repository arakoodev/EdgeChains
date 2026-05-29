{
  prompt: |||
    Answer the following question in one concise sentence:
    %(question)s
  |||,
  model: 'gemini-pro',
  responseType: 'text/plain',
  temperature: 0.2,
  maxOutputTokens: 128,
}
