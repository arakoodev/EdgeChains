# Resume Reviewer Example

This is an example project that demonstrates the usage of Resume-Reviewer

## Video Link

```bash
https://youtu.be/eBUWRL9vNYc
```

## Configuration

1 Add OpenAiApi key in secrets.jsonnet

    ```bash
    local OPENAI_API_KEY = "sk-****";
    ```

## Installation

1. Install the dependencies:

   ```bash
   cd backend
   npm install
   ```

2 Run the Database (When you run db it should be running, don't close it otherwise you don't able to get database access)

    ```bash
    npm run db
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

2. Open the frontend/index.html with live server

   ```bash
       http://localhost:5500/JS/edgechains/examples/resume-reviewer/frontend/
   ```
