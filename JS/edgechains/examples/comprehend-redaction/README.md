# AWS Comprehend prompt redaction

This example detects personally identifiable information with AWS Comprehend
and redacts it before a downstream endpoint receives the prompt. It uses the
public `ComprehendRedactor` middleware and does not log the original prompt.

Set `AWS_REGION`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY` in the
environment, then run the example through the repository's TypeScript runner.
No credentials are stored in this repository.
