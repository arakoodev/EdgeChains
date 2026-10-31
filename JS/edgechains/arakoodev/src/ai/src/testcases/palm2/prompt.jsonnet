local promptTemplate(subject) = {
    prompt: "Explain the architectural advantages of " + subject + " in 2 concise bullet points.",
    temperature: 0.2,
    maxOutputTokens: 256,
    model: "text-bison-001"
};

{
    generatePrompt(subject): promptTemplate(subject)
}
