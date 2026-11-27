# Tree of Thoughts Example

Demonstrates the breadth-first **Tree-of-Thoughts** reasoning chain
(`TreeOfThoughtsChain`) over a problem. The chain generates `k` candidate
thoughts per step, scores each, keeps the most promising `breadth` states, and
expands them up to `maxDepth`, returning the best path found.

## Installation

1. Install the required dependencies:

    ```bash
    npm install
    ```

## Configuration

1. Add your OpenAI API key in `jsonnet/secrets.jsonnet`:

    ```jsonnet
    local OPENAI_API_KEY = "sk-****";
    ```

## Usage

1. Start the server:

    ```bash
    npm run start
    ```

2. Hit the `POST` endpoint with a problem:

    ```bash
    curl -X POST http://localhost:3000/tot \
      -H "Content-Type: application/json" \
      -d '{"problem": "What is 17 * 24? Think step by step."}'
    ```

The response contains the best `answer`, its `score`, and the full `bestPath`.