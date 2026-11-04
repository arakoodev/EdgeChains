{
  chat: {
    model: 'fixture-model',
    prompt: 'Summarize the following synthetic event: a parcel arrived.',
    temperature: 0,
    top_p: 0,
    top_k: 1,
    max_output_tokens: 32,
    candidate_count: 1,
    stop_sequences: ['END'],
    responseType: 'application/json',
    max_retry: 1,
    delay: 0,
  },
  conversation: {
    systemInstruction: { parts: [{ text: 'Keep the answer to one sentence.' }] },
    contents: [
      { role: 'user', parts: [{ text: 'A parcel arrived.' }] },
      { role: 'model', parts: [{ text: 'The parcel was delivered.' }] },
      { role: 'user', parts: [{ text: 'What was delivered?' }] },
    ],
    generationConfig: { temperature: 0, maxOutputTokens: 16 },
    safetySettings: [{ category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' }],
  },
  question: 'What is two plus two?',
  unicodeQuestion: '請問包裹到了嗎？📦',
}
