# Google PaLM 2 Example

Demonstrates using `Palm2AI` (`@arakoodev/edgechains.js/ai`) with Jsonnet prompt templates (`jsonnet/main.jsonnet` and `jsonnet/secrets.jsonnet`).

## Usage

1. Set your `palm_api_key` in `jsonnet/secrets.jsonnet`.
2. Build and start the server:

```bash
npm install
npm start
```

3. Query the `/chat` endpoint:

```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"question": "What are the advantages of Jsonnet for prompt engineering?"}'
```
