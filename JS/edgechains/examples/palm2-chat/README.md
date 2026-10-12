# PaLM2-compatible Google AI example

Google retired the original PaLM models, so `Palm2AI` keeps the requested class name while using
the maintained Generative Language `generateContent` API. The prompt lives in
`jsonnet/main.jsonnet`, not in TypeScript.

```sh
npm install
npm run build
GEMINI_API_KEY=your-key npm start
```
