local defaultConfig = {
    textModel: "text-bison-001",
    chatModel: "chat-bison-001",
    embeddingModel: "embedding-gecko-001",
    temperature: 0.7,
    candidateCount: 1,
    maxOutputTokens: 1024,
};

{
    palm2Config(overrides={}):: defaultConfig + overrides,
}
