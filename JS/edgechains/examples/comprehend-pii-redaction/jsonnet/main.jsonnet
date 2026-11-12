local promptTemplate = |||
  Please summarize this support request without exposing private information:

  {request}
|||;

local request = std.extVar('request');

{
  prompt: std.strReplace(promptTemplate, '{request}', request),
  languageCode: 'en',
  minScore: 0.5,
}
