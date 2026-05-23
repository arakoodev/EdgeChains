# Palm2/Gemini Chat Example

## Configuration

Add a Gemini API key in `jsonnet/secrets.jsonnet`.

## Usage

```bash
npm install
npm run start
```

Send a request:

```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"question":"What is EdgeChains?"}'
```
