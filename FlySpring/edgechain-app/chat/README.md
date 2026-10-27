# Simple Chat test

- Edit SimpleApp.java and set your OpenAI key

- Run the server using `./run.sh` or enter `java -jar ../target/edgechain.jar jbang SimpleApp.java`

- Wait for server to start

- In a separate terminal call the server using `./callserver.sh` or enter

```bash
curl --location 'localhost:8080/v1/examples/gpt/ask' \
--header 'Content-Type: application/json' \
--data '{
    "prompt": "Who was Nikola Tesla?"
}'
```

   - After a short time text should appear similar to `Ah, my dear interlocutor, allow me to regale you with the tale of Nikola Tesla! Born in 1856, this remarkable gentleman ` ...

- Close the server terminal using `ctrl+c`
