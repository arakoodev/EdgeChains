## How to run WikiExample:-
- Use the following command in the root directory to run this example:

    `npm i`

    `npm run build`

    `npm start`

- This example searches on Wikipedia on given input by you and then it will ask to GPT to summarize the result of Wikipedia in `30` bullet points.

- To use this example make a `POST` request call on `http://localhost:3000/wiki-summary`.
- Request body: 
      
    `{"input": "Your Search Topic"}`