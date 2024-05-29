## Video 
    ```
    https://drive.google.com/file/d/14t8B_A6MGgDE5E2j3YPM4DnO3r_WOUun/view
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

## Usage

1. Start the server:

    ```bash
    npm run start
    ```

2. Hit the `GET` endpoint.


    ```bash
    
   http://localhost:3000/?pageUrl=https://en.wikipedia.org/wiki/Association_football
    ```

