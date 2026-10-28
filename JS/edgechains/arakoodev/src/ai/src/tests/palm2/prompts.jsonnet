local systemContext = "You are a concise technical assistant specializing in distributed systems.";

local textPromptTemplate = "Explain the benefits of declarative prompt engineering in {topic}.";
local chatUserTurn1 = "How does Jsonnet help manage LLM prompt templates?";
local chatAssistantTurn1 = "Jsonnet enables modular, hermetic, data-driven prompt composition.";
local chatUserTurn2 = "Give a one-sentence summary of why hardcoded prompts should be avoided.";
local embeddingSample = "EdgeChains declarative prompt orchestration with Jsonnet and Google PaLM 2.";

{
  system_context: systemContext,
  text_prompt: std.strReplace(textPromptTemplate, "{topic}", "EdgeChains"),
  chat_messages: [
    { author: "user", content: chatUserTurn1 },
    { author: "assistant", content: chatAssistantTurn1 },
    { author: "user", content: chatUserTurn2 }
  ],
  embedding_text: embeddingSample
}
