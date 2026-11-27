{
    model: "models/chat-bison-001",
    textModel: "models/text-bison-001",
    embeddingModel: "models/embedding-gecko-001",
    temperature: 0.5,
    maxOutputTokens: 512,
    context: "You are a helpful EdgeChains AI assistant powered by Google PaLM 2 and Jsonnet.",
    textPrompt: "List three benefits of declarative prompt engineering with Jsonnet in EdgeChains.",
    messages: [
        {
            author: "user",
            content: "How do I configure Google PaLM 2 in an EdgeChains project?",
        },
    ],
    embeddingText: "Google PaLM 2 text-bison-001, chat-bison-001, and embedding-gecko-001 in EdgeChains.",
}
