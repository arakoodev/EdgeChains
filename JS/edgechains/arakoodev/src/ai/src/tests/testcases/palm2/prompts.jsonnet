local subject = 'turtles';
{
    prompt: 'Give one fact about ' + subject + '.',
    model: 'gemini-2.5-flash',
    temperature: 0,
    max_output_tokens: 64,
    responseType: 'application/json',
}
