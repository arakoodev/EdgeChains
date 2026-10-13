{
  // Prompts for the palm2 testcases. Loaded by the tests via @arakoodev/jsonnet
  // so no prompts are hardcoded in the test sources.
  text_prompt: 'What is the capital of France?',
  text_prompt_with_options: 'Summarize the EdgeChains JavaScript SDK in one sentence.',
  chat_messages: [
    { content: 'Hello', author: 'user' },
    { content: 'Hi! What would you like to know?', author: 'assistant' },
    { content: 'What is the meaning of life?', author: 'user' },
  ],
}
