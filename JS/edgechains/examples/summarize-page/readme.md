## Video

    ```
    https://youtu.be/4gouiNUuBr4
    ```

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

2. Hit the `GET` endpoint.

    ```bash

    http://localhost:3000/?pageUrl=https://en.wikipedia.org/wiki/Association_football
    ```
