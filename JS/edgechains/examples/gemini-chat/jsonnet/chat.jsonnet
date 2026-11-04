{
  model: std.extVar('model'),
  prompt: 'Answer the following question briefly.\n' + std.extVar('question'),
  temperature: 0,
  max_output_tokens: 128,
  responseType: 'text/plain',
}
