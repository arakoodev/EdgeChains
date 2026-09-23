local inputPrompt = std.extVar("input_prompt");

local redactPrompt(prompt) =
  std.parseJson(arakoo.native("redactPrompt")({
    prompt: prompt,
    languageCode: "en",
    replacement: "[REDACTED_{type}]",
  }));

local main() =
  {
    originalPrompt: inputPrompt,
    redactedPrompt: redactPrompt(inputPrompt),
  };

main()
