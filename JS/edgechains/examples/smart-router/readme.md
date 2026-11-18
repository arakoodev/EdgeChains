# Smart Router Example

This example loads router deployments from Jsonnet and sends a chat request through the SmartRouter. The router selects the deployment below its request/token limits with the least cumulative token usage, tracks usage, supports streaming, and exposes logging callbacks.

## Setup

```bash
npm install
OPENAI_API_KEY=sk-... npm start
```
