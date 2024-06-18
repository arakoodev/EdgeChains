## Video

    ```
    https://youtu.be/fq3BpdduO2g
    ```

# Chat with LLM Example

## Installation

1. Install the required dependencies:

    ```bash
    npm install
    ```

## Configuration

1 Add OpenAiApi key in secrets.jsonnet
`bash
    local OPENAI_API_KEY = "sk-****";
    `

## Usage

1. Start the server:

    ```bash
    npm run start
    ```

2. Hit the `POST` endpoint with basic question `http://localhost:3000/chat`.

    ```bash

    body = {
        "question":"hi"
    }
    ```

## Compilation to wasm

> For compilation to wasm you must have arakoo-compiler and arakoo runtime installed (For installation instruction you can refer the [readme](https://github.com/redoC-A2k/EdgeChains#setup-1))

1. Build the arakoo runtime compatible wasm

```bash
npm run wasm
```

2. Run the wasm with runtime (index.wasm will be in the directory in which you run npm run wasm)

```bash
arakoo index.wasm
```

Now you are good to go send the request to port 8080
