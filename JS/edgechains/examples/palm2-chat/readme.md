# Palm2 Chat Example

Chat with Google Palm2 using EdgeChains. Prompts are defined in a jsonnet file
rather than hardcoded.

## Setup

1. Install dependencies:

    ```bash
    npm install
    ```

2. Set your Google API key in `jsonnet/secrets.jsonnet`.

## Run

```bash
npm run start "Your question here"
```

The prompt template lives in `jsonnet/main.jsonnet` and the answer is returned
by the Palm2 `text-bison-001` model.
