local subject = 'turtles';
{
    model: 'gemini-3.5-flash-lite',
    prompt: 'Explain in two sentences how ' + subject + ' breathe.',
    temperature: 0.7,
    max_output_tokens: 1024,
    responseType: 'text/plain',
}
