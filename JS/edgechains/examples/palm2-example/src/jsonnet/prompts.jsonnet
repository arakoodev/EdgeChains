local topic = std.extVar("topic");
local palm2_api_key = std.extVar("palm2_api_key");
{
  "summarize": "Summarize the following topic in 3 bullet points: " + topic,
  "palm2_api_key": palm2_api_key,
}
