# Next.js Chat Template

This example demonstrates how to use EdgeChains with Next.js and React Server Components. The logic lives in `jsonnet/main.jsonnet` and JavaScript functions inside `lib/` are registered as Jsonnet callbacks.

## Setup

```bash
cd ec-2/nextjs-chat-template
npm install
```

Edit `jsonnet/secrets.jsonnet` with your API keys then run the development server:

```bash
npm run dev
```

Visit `http://localhost:3000` and ask a question.
