local topic = std.extVar('topic');

{
    model: 'gemini-pro',
    prompt: 'Explain ' + topic + ' in two concise paragraphs for TypeScript engineers.',
    temperature: 0.2,
    maxOutputTokens: 512,
}
