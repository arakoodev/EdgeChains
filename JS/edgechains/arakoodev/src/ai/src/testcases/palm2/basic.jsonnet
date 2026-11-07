local topic = std.extVar('topic');

{
    model: 'text-bison-001',
    prompt: 'Explain ' + topic + ' in one concise sentence.',
    temperature: 0.2,
    maxOutputTokens: 256,
}
