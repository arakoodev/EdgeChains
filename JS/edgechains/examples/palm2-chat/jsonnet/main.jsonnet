local key = std.extVar('palm2_api_key');
local prompt = std.extVar('prompt');

{
  prompt: prompt,
  response: std.native('palm2Chat')({ apiKey: key, prompt: prompt }),
}

