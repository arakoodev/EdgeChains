{
  name: 'palm2-basic-generate-text',
  provider: 'palm2',
  model: 'text-bison-001',
  input: {
    prompt: 'Answer in one sentence: what is EdgeChains?',
    temperature: 0.2,
    candidate_count: 1,
    max_output_tokens: 128,
  },
}
