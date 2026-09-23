# Palm2 Example

This example shows how to call Google's **Palm2** (`text-bison-001`) API through the
`Palm2AI` class from `@arakoodev/edgechains.js/ai`. The prompt lives in a jsonnet file
(`jsonnet/main.jsonnet`) and is **not** hardcoded in the TypeScript source.

## Installation

1. Install the required dependencies:

    ```bash
    npm install
    ```

## Configuration

1. Add your Palm2 API key in `jsonnet/secrets.jsonnet`:

    ```jsonnet
    local PALM2_API_KEY = "***";
    ```

    You can also set it through the `PALM_API_KEY` environment variable.

## Usage

1. Start the server:

    ```bash
    npm run start
    ```

2. Hit the `POST` endpoint with a basic question at `http://localhost:3000/chat`.

    ```bash
    body = {
        "question": "hi"
    }
    ```
