local promptTemplate = |||
  Send the onboarding details to {name} at {email}. Call them at {phone} if the message bounces.
|||;

{
  prompt: std.strReplace(
    std.strReplace(
      std.strReplace(promptTemplate, '{name}', std.extVar('customer_name')),
      '{email}',
      std.extVar('customer_email')
    ),
    '{phone}',
    std.extVar('customer_phone')
  ),
  redaction: {
    languageCode: 'en',
    minScore: 0.8,
    redactionMode: 'replace',
  },
}
