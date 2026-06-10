{
  name: 'aws-comprehend-redaction',
  description: 'Redact PII before passing prompts to an AI endpoint',
  steps: [
    'Create an AwsComprehendRedactor',
    'Redact a prompt with chain(prompt, endpoint)',
    'Redact a prompt stream with redactObservable(source)',
  ],
}
