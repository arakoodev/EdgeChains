local prompt = std.extVar('prompt');
local apiKey = std.extVar('palm2_api_key');

arakoo.native('palm2Call')({ prompt: prompt, apiKey: apiKey })
