// G-Eval response-evaluation template (https://arxiv.org/abs/2303.16634)
//
// Scores an AI-generated response against a rubric aspect (coherence,
// consistency, fluency, relevance) using an LLM-as-a-judge pattern.
//
// External variables (set via jsonnet.extString before evaluating):
//   - prompt        : the user prompt / question that produced the response
//   - response      : the model-generated response to evaluate
//   - context       : source information the response is grounded in (may be "")
//   - aspect        : one of coherence | consistency | fluency | relevance
//   - openai_api_key: API key used by the openAICall native callback
//
// Native callback (set via jsonnet.javascriptCallback):
//   - openAICall({ prompt, openAIApiKey }) => { content: "<judge output>" }
//
// Output (JSON string):
//   { aspect, evaluation_prompt, judge_output }

local prompt = std.extVar('prompt');
local response = std.extVar('response');
local context = std.extVar('context');
local aspect = std.extVar('aspect');
local key = std.extVar('openai_api_key');

local aspectDefinitions = {
  coherence: 'the collective quality of all sentences; how well the response is structured and organized.',
  consistency: 'the factual alignment of the response against the given source information.',
  fluency: 'the quality of the response in terms of grammar, spelling, punctuation, word choice and sentence structure.',
  relevance: 'the selection of important content from the source; how well the response captures the key information.',
};

local definition =
  if std.objectHas(aspectDefinitions, aspect) then
    aspectDefinitions[aspect]
  else
    aspectDefinitions['coherence'];

local contextBlock =
  if std.length(context) > 0 then
    'Source Information:\n' + context + '\n\n'
  else
    '';

local evalPrompt =
  'You are an impartial judge evaluating the quality of an AI-generated response.\n' +
  '\n' +
  'Evaluation Aspect:\n' +
  aspect + ': ' + definition + '\n' +
  '\n' +
  'Evaluation Steps:\n' +
  '1. Read the user prompt, the source information (if any) and the response carefully.\n' +
  '2. Compare the response against the "' + aspect + '" criteria described above.\n' +
  '3. Write a short justification explaining how well the response satisfies the "' + aspect + '" criteria.\n' +
  '4. Assign a score from 1 to 5, where 1 = very poor and 5 = excellent.\n' +
  '\n' +
  'Respond STRICTLY in the following format:\n' +
  'Justification: <one or two sentences>\n' +
  'Score: <integer between 1 and 5>\n' +
  '\n' +
  contextBlock +
  'User Prompt:\n' + prompt + '\n' +
  '\n' +
  'Response to evaluate:\n' + response + '\n' +
  '\n' +
  'Now produce the Justification and Score.';

local main() =
  local judgeOutput = arakoo.native('openAICall')({ prompt: evalPrompt, openAIApiKey: key });
  {
    aspect: aspect,
    evaluation_prompt: evalPrompt,
    judge_output: judgeOutput,
  };

main()