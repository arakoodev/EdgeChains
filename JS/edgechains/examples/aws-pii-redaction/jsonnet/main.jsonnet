local textToRedact = std.extVar('text');

local main() =
  local response = arakoo.native('awsRedact')({ text: textToRedact });
  {
    redactedText: response
  };

main()
