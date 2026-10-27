local promptTemplate = |||
  Summarize the following customer support message safely:
  {redacted_message}
|||;

local redactedMessage = std.extVar('redacted_message');

local main() =
  std.strReplace(promptTemplate, '{redacted_message}', redactedMessage);

main()
