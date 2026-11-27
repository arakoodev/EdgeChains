local topic = std.extVar("topic");

{
  prompt: "Summarize the following topic in one sentence: " + topic,
  systemInstruction: "You are a concise assistant. Answer with a single sentence.",
}
