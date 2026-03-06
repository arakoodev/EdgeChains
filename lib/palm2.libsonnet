// palm2.libsonnet - Helper library for Palm2/Gemini API

{
  // Generate text completion
  generate(params):: {
    apiEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models/' + params.config.model + ':generateContent',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': params.config.apiKey,
    },
    body: {
      contents: [{
        parts: [{ text: params.prompt }],
      }],
      generationConfig: {
        temperature: params.config.temperature,
        maxOutputTokens: params.config.maxTokens,
        [if 'topP' in params.config then 'topP']: params.config.topP,
        [if 'topK' in params.config then 'topK']: params.config.topK,
        [if 'responseMimeType' in params.config then 'responseMimeType']: params.config.responseMimeType,
      },
    },
  },

  // Multi-turn chat
  chat(params):: {
    apiEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models/' + params.config.model + ':generateContent',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': params.config.apiKey,
    },
    body: {
      contents: [
        {
          role: msg.role,
          parts: [{ text: msg.content }],
        }
        for msg in params.messages
      ],
      generationConfig: {
        temperature: params.config.temperature,
        maxOutputTokens: params.config.maxTokens,
      },
    },
  },

  // Generate embeddings
  embed(params):: {
    apiEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models/embedding-001:batchEmbedContents',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': params.config.apiKey,
    },
    body: {
      requests: [
        {
          content: {
            parts: [{ text: text }],
          },
        }
        for text in params.texts
      ],
    },
  },

  // Count tokens
  countTokens(params):: {
    apiEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models/' + params.config.model + ':countTokens',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': params.config.apiKey,
    },
    body: {
      contents: [{
        parts: [{ text: params.text }],
      }],
    },
  },

  // List available models
  listModels(params):: {
    apiEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    method: 'GET',
    headers: {
      'x-goog-api-key': params.config.apiKey,
    },
  },
}
