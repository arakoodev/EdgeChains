# Resume Reviewer Example

This is an example project that demonstrates the usage of Resume-Reviewer

## Video Link

```bash
https://youtu.be/xy3DRI4Y898
```

## Configuration

1 Add OpenAiApi key in secrets.jsonnet

    ```bash
    local OPENAI_API_KEY = "sk-****";
    ```

2 Add Postgres connection string into .env file

    ```bash
    DATABASE_URL="postgresql:**********"
    ```

## Installation

1. Install the dependencies:

    ```bash
    cd backend
    npm install
    ```

3 Run the migrations

    ```bash
    npm run migration
    ```

## Usage

1. Start the server:

    ```bash
    npm run start
    ```

2. hit this endpoint

    ```bash
        http://localhost:3000
    ```
