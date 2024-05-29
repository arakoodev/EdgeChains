## Video

    ```
    https://drive.google.com/file/d/1QclGlD6mDEN9PMDEXAMkdZb0wY5uew8p/view
    ```

# Project Name

This is a Language Translate app

## Backend

### Configuration

1 Add OpenAiApi key in secrets.jsonnet

    ```
     local OPENAI_API_KEY = "sk-****";
    ```

## Usage

1. Start the server:

    ```bash
    cd backend
    npm run start
    ```

### Run With frontend

1. Open the frontend/index.html file with live server

2. Hit the endpoint in your browser if you're running the app from our examples

    ```bash
    http://localhost:5500/JS/edgechains/examples/language-translater/frontend/
    ```

### Run With endpoint

1. Hit the `POST` endpoint.

```bash
http://localhost:3000/translate

body={
    "language":"hindi",
    "text":"hi, how are you"
}
```
