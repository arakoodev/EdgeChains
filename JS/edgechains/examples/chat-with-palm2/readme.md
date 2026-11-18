# Chat with Palm2 Example

## Video

Add a Loom demo showing the `/chat` endpoint calling Palm2 through jsonnet.

## Installation

1. Install the required dependencies:

    ```bash
    npm install
    ```

## Configuration

1. Add your Palm2 API key in `jsonnet/secrets.jsonnet`:

    ```jsonnet
    {
      palm2_api_key: 'AIza...'
    }
    ```

## Usage

1. Start the server:

    ```bash
    npm run start
    ```

2. Send a `POST` request to `http://localhost:3000/chat`.

    ```json
    {
      "question": "hi"
    }
    ```

## Compilation to wasm

1. Build the wasm bundle:

    ```bash
    npm run wasm
    ```

2. Run it:

    ```bash
    arakoo index.wasm
    ```
