# Google PaLM 2 Example (EdgeChains JS/TS)

This example demonstrates how to use the `Palm2AI` (`Palm2Endpoint`) class in `@arakoodev/edgechains.js` with prompts defined declaratively inside `jsonnet/main.jsonnet`.

## Setup

1. Add your Google PaLM 2 API key to `jsonnet/secrets.jsonnet`.
2. Build and run the server:

```bash
npm install
npm start
```

3. Query the endpoint:

```bash
curl "http://localhost:5000?question=What+is+the+capital+of+Australia"
```
