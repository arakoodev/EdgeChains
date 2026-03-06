// Example: Using Palm2/Gemini API with jsonnet prompts
// This demonstrates dynamic prompt loading without hardcoding

local palm2 = import 'palm2.libsonnet';

// Configuration - can be overridden at runtime
local config = {
  apiKey: std.extVar('GOOGLE_API_KEY'),
  model: std.extVar('MODEL') || 'gemini-pro',
  temperature: std.parseJson(std.extVar('TEMP') || '0.7'),
  maxTokens: std.parseInt(std.extVar('MAX_TOKENS') || '1024'),
};

// Example 1: Simple text generation
{
  name: 'simple_generation',
  request: palm2.generate({
    prompt: 'Explain quantum computing in simple terms',
    config: config,
  }),
}

// Example 2: Structured output with schema
{
  name: 'structured_output',
  request: palm2.generate({
    prompt: |||
      Extract information from this text and return as JSON:
      "John Doe is a software engineer at Google with 5 years experience"
      
      Schema:
      {
        "name": string,
        "job_title": string,
        "company": string,
        "years_experience": number
      }
    |||,
    config: config + {
      responseMimeType: 'application/json',
    },
  }),
}

// Example 3: Multi-turn conversation
{
  name: 'conversation',
  request: palm2.chat({
    messages: [
      { role: 'user', content: 'What is machine learning?' },
      { role: 'model', content: 'Machine learning is a subset of AI...' },
      { role: 'user', content: 'Can you give me an example?' },
    ],
    config: config,
  }),
}

// Example 4: Text embedding for similarity search
{
  name: 'embeddings',
  request: palm2.embed({
    texts: [
      'The cat sat on the mat',
      'A feline rested on the rug',
      'The stock market crashed today',
    ],
    config: config,
  }),
}

// Example 5: Classification with few-shot prompting
local fewShotExamples = [
  { text: 'I love this product!', label: 'positive' },
  { text: 'This is terrible', label: 'negative' },
  { text: 'It\'s okay I guess', label: 'neutral' },
];

{
  name: 'classification',
  request: palm2.generate({
    prompt: |||
      Classify the sentiment of the following text as positive, negative, or neutral.
      
      Examples:
      %(examples)s
      
      Text: %(target)s
      Sentiment:
    ||| % {
      examples: std.join('\n', [
        'Text: %s\nSentiment: %s' % [ex.text, ex.label]
        for ex in fewShotExamples
      ]),
      target: std.extVar('TARGET_TEXT'),
    },
    config: config,
  }),
}

// Example 6: Chain of thought reasoning
{
  name: 'chain_of_thought',
  request: palm2.generate({
    prompt: |||
      Solve this step by step:
      
      A store sells apples for $0.50 each and oranges for $0.75 each.
      If I buy 4 apples and 3 oranges with a $10 bill, how much change will I get?
      
      Let's think through this:
    |||,
    config: config + {
      temperature: 0.3,  // Lower temp for reasoning
    },
  }),
}

// Example 7: Dynamic prompt from external data
local loadPrompt(name) = 
  std.parseJson(std.extVar('PROMPT_' + name));

{
  name: 'dynamic_prompt',
  request: palm2.generate({
    prompt: loadPrompt('SUMMARIZATION'),
    config: config,
  }),
}
