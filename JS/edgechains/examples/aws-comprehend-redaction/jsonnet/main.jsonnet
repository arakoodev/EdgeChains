local promptTemplate = |||
  Write a concise account-risk summary for this customer conversation.
  Do not expose personal data in the output.

  Conversation:
  {redacted_prompt}
|||;

local redactedPrompt = std.extVar('redacted_prompt');

{
  prompt: std.strReplace(promptTemplate, '{redacted_prompt}', redactedPrompt),
}
