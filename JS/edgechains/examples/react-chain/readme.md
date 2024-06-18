# React Chain Example

This is an example project that demonstrates the usage of React Chain.

## Configuration

1 Add OpenAiApi key in secrets.jsonnet

    ```bash
    local OPENAI_API_KEY = "sk-****";
    ```

## Installation

1. Install the dependencies:

    ```bash
    npm install
    ```

## Usage

1. Start the server:

    ```bash
    npm run start
    ```

2. Hit the `GET` endpoint with question

    ```bash
    http://localhost:5000?question=Author David Chanoff has collaborated with a U.S. Navy admiral who served as the ambassador to the United Kingdom under which President?
    ```

## Compilation to wasm 

> For compilation to wasm you must have arakoo-compiler and arakoo runtime installed (For installation instruction you can refer the [readme ](https://github.com/redoC-A2k/EdgeChains#setup-1))

1. Build the arakoo runtime compatible wasm 
```bash
npm run wasm
```

2. Run the wasm with runtime (index.wasm will be in the directory in which you run npm run wasm)
```bash
arakoo index.wasm
```

Now you are good to go send the request to port 8080