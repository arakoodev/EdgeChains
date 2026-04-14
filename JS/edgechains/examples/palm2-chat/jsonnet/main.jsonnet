local palm2_api_key = std.extVar("palm2_api_key");
local question = std.extVar("question");

local main() =
  local response = arakoo.native('palm2Call')({
    prompt: "You are a helpful assistant. Answer the following question: " + question,
    palm2ApiKey: palm2_api_key
  });
  { "palm2_response": response };

main()
