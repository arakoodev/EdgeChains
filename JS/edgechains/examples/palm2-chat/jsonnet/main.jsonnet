local topic = std.extVar('topic');

{
  model: 'gemini-pro',
  prompt: 'Explain ' + topic + ' in two short paragraphs for a developer audience.',
  temperature: 0.2,
  maxOutputTokens: 512,
}
