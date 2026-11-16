# PaLM2 & Gemini Chat Example with Jsonnet

This example demonstrates how to integrate Google PaLM2 / Gemini API in EdgeChains JavaScript / TypeScript SDK using `Palm2AI` and external Jsonnet prompt templates.

## Highlights
- **No hardcoded prompts:** Prompts and hyperparameters (`model`, `temperature`, `maxOutputTokens`) are declared in `jsonnet/main.jsonnet`.
- **PaLM2 & Gemini Support:** Uses `Palm2AI` provider with full typing support.

## Usage

```bash
export PALM2_API_KEY="your-google-ai-api-key"
# or export GOOGLE_API_KEY="your-google-ai-api-key"

npm install
npm run start
```
