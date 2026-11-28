# Palm2 / Gemini Chat Example

This example uses a Jsonnet prompt file and the `Palm2AI` client from `@arakoodev/edgechains.js/ai`.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Add your Google API key in `jsonnet/secrets.jsonnet`:

   ```jsonnet
   local GOOGLE_API_KEY = "AIza...";
   ```

3. The prompt stays in `jsonnet/main.jsonnet`, so you can change the question without editing TypeScript.

## Usage

Run the example:

```bash
npm run start -- "Explain EdgeChains in one paragraph"
```

If you do not pass a question, the example uses a default prompt.
