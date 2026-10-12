local config = import '../../../arakoodev/testcases/palm2/chat.jsonnet';
local key = std.extVar('gemini_api_key');
local question = std.extVar('question');
local prompt = std.strReplace(config.prompt, '%(question)s', question);

{
  apiKey: key,
  model: config.model,
  prompt: prompt,
  responseType: config.responseType,
  temperature: config.temperature,
  maxOutputTokens: config.maxOutputTokens,
}
