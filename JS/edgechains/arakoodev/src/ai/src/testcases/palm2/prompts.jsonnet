local topic = std.extVar("topic");

local textPromptTemplate = |||
    Explain the core architecture of {topic} in two concise sentences.
|||;

local chatContextTemplate = |||
    You are an expert AI assistant specializing in {topic}.
|||;

local chatUserPromptTemplate = |||
    What are the primary benefits of using {topic} in production?
|||;

local embeddingTextTemplate = |||
    Semantic vector representation for {topic}.
|||;

local schemaPromptTemplate = |||
    Provide a structured summary for {topic} including title and key takeaway.
|||;

{
    textPrompt: std.strReplace(textPromptTemplate, "{topic}", topic),
    chatContext: std.strReplace(chatContextTemplate, "{topic}", topic),
    chatUserPrompt: std.strReplace(chatUserPromptTemplate, "{topic}", topic),
    embeddingText: std.strReplace(embeddingTextTemplate, "{topic}", topic),
    schemaPrompt: std.strReplace(schemaPromptTemplate, "{topic}", topic),
}
