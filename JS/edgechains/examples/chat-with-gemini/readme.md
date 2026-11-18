# Chat with Gemini Example

## Installation

1. Install the required dependencies:

    ```bash
    npm install
    ```

## Configuration

1. Add your Gemini API key in `jsonnet/secrets.jsonnet`:

    ```jsonnet
    local GEMINI_API_KEY = "your-gemini-api-key-here";
    ```

   You can get a free API key from [Google AI Studio](https://aistudio.google.com/apikey).

## Usage

1. Start the server:

    ```bash
    npm run start
    ```

2. Hit the `POST` endpoint at `http://localhost:3000/chat`:

    ```bash
    curl -X POST http://localhost:3000/chat \
      -H "Content-Type: application/json" \
      -d '{"question": "What is EdgeChains?"}'
    ```

    Request body:

    ```json
    {
        "question": "What is EdgeChains?"
    }
    ```
