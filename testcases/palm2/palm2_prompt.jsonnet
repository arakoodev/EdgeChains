local base = {
  name: 'palm2_example',
  model: 'palm2',
  temperature: 0.7,
  maxTokens: 1024
};

base + {
  prompt: {
    system: 'You are a helpful AI assistant.',
    user: '{{input}}'
  }
}
