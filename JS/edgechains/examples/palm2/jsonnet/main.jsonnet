// Prompt templates for the PaLM 2 example. Edit this file to change prompts,
// models and sampling parameters - no TypeScript changes required.

local textTemplate = |||
  You are a concise, helpful assistant.
  Answer the following question about {topic}: {question}
|||;

local chatGreeting = "Hello! I am researching {topic}. What should I know first?";

local embedText = "Lineage 2 is a classic MMORPG featuring the race {race}.";

local topic = std.extVar('topic');
local question = std.extVar('question');
local race = std.extVar('race');

local fill(template, vars) =
  std.foldl(
    function(acc, v) std.strReplace(acc, '{' + v[1] + '}', v[0]),
    [[vars[k], k] for k in std.objectFields(vars)],
    template
  );

{
  generateText: {
    model: 'text-bison-001',
    prompt: fill(textTemplate, { topic: topic, question: question }),
    temperature: 0.2,
    maxOutputTokens: 256,
  },
  chat: {
    model: 'chat-bison-001',
    context: 'The user is an expert in %s.' % topic,
    messages: [
      { author: 'user', content: fill(chatGreeting, { topic: topic }) },
    ],
    temperature: 0.7,
  },
  embeddings: {
    model: 'embedding-gecko-001',
    text: fill(embedText, { race: race }),
  },
}
