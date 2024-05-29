## Video 
    ```
    https://drive.google.com/file/d/1amBXmUZVyWR6l-MaYuE9h6zAJyvIYNIp/view
    ```

## Installation

1. Install the required dependencies:

    ```bash
    npm install
    ```

## Configuration

1  Add OpenAiApi key in secrets.jsonnet

    ```bash
    local OPENAI_API_KEY = "sk-****";
    ```

2  Add RapidAPIKey key in secrets.jsonnet
<!-- You can get from  https://rapidapi.com/weatherapi/api/weatherapi-com/  remember different api returns different response that may be not working with this app-->

    ```bash
    local Rapid_API_Key = "e8c7527e*****";
    ```

## Usage

1. Start the server:

    ```bash
    npm run start
    ```

2. Hit the `GET` endpoint.


    ```bash
   http://localhost:3000?question=Paris temperature
    ```
    or

    ```bash
   http://localhost:3000?question=Paris time
    ```

