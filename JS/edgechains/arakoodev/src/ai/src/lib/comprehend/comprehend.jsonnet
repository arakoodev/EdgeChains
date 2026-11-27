local comprehendConfig = {
  service: "aws-comprehend",
  region: "us-east-1",
  languageCode: "en",
  minConfidence: 0.75,
  maskMode: "TAG",
  piiEntityTypes: [
    "EMAIL",
    "PHONE",
    "SSN",
    "CREDIT_DEBIT_NUMBER",
    "BANK_ACCOUNT_NUMBER",
    "NAME",
    "ADDRESS",
    "AWS_ACCESS_KEY",
    "AWS_SECRET_KEY",
  ],
  redact(text, entities) :: {
    originalText: text,
    entities: std.filter(function(e) e.Score >= comprehendConfig.minConfidence, entities),
  },
};

comprehendConfig
