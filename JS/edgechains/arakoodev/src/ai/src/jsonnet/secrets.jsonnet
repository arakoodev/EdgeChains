// EdgeChains Smart Router Secrets Configuration
//
// IMPORTANT: This file contains API keys and should NEVER be committed
// to version control. Add it to .gitignore.
//
// In production, load secrets from environment variables or a secure
// secrets manager instead of hardcoding them here.

{
  // OpenAI API credentials
  openaiApiKey: std.extVar('OPENAI_API_KEY'),
  openaiOrgId: std.extVar('OPENAI_ORG_ID'),

  // Google Gemini API key
  geminiApiKey: std.extVar('GEMINI_API_KEY'),

  // Cohere API key
  cohereApiKey: std.extVar('COHERE_API_KEY'),
}
