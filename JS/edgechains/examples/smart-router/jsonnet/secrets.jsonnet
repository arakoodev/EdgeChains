// Smart Router Example — Secrets Configuration
// Load API keys from environment variables

{
  openaiApiKey: std.extVar('OPENAI_API_KEY'),
  openaiOrgId: std.extVar('OPENAI_ORG_ID'),
  geminiApiKey: std.extVar('GEMINI_API_KEY'),
  cohereApiKey: std.extVar('COHERE_API_KEY'),
}
