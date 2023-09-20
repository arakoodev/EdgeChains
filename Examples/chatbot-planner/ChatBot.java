package com.edgechain;

import com.edgechain.lib.endpoint.impl.OpenAiEndpoint;
import com.edgechain.lib.jsonnet.JsonnetArgs;
import com.edgechain.lib.jsonnet.JsonnetLoader;
import com.edgechain.lib.jsonnet.enums.DataType;
import com.edgechain.lib.jsonnet.impl.FileJsonnetLoader;
import com.edgechain.lib.openai.request.ChatMessage;
import com.edgechain.lib.request.ArkRequest;
import com.edgechain.lib.rxjava.retry.impl.ExponentialDelay;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;


import java.util.ArrayList;
import java.util.List;
import java.util.Properties;
import java.util.concurrent.TimeUnit;

import static com.edgechain.lib.constants.EndpointConstants.OPENAI_CHAT_COMPLETION_API;

@SpringBootApplication
public class ChatBot {

    private static final String OPENAI_AUTH_KEY = ""; // YOUR OPENAI KEY
    private static final String OPENAI_ORG_ID = ""; // YOUR OPENAI KEY
    private static final String TMDB_TOKEN = ""; // TMDB_TOKEN
    private static OpenAiEndpoint gpt3Endpoint;
    private static JsonnetLoader loader = new FileJsonnetLoader("./chatbot-planner/planner.jsonnet"); // JSONNET FILE PATH


    public static void main(String[] args) {
        System.setProperty("server.port", "8080");


        Properties properties = new Properties();

        properties.setProperty("postgres.db.host", "");
        properties.setProperty("postgres.db.username", "");
        properties.setProperty("postgres.db.password", "");


        new SpringApplicationBuilder(ChatBot.class).run(args);

        gpt3Endpoint = new OpenAiEndpoint(
                OPENAI_CHAT_COMPLETION_API,
                OPENAI_AUTH_KEY,
                OPENAI_ORG_ID,
                "gpt-3.5-turbo",
                "user",
                0.7,
                new ExponentialDelay(3, 5, 2, TimeUnit.SECONDS)
        );
    }


    @RestController
    @RequestMapping("/example/chatbot")
    public class Conversation {
        Logger logger = LoggerFactory.getLogger(getClass());
        private List<ChatMessage> messages;

        public Conversation() {
            messages = new ArrayList<>();
        }

        @PostMapping("/ask")
        public String askGPT(ArkRequest arkRequest) {
            messages.add(new ChatMessage("system", "You are a English assistant. Answer the user prompt with a bit of humor."));
            String prompt = arkRequest.getBody().getString("prompt");
            updateMessageList("user", prompt);


            String response = new EdgeChain<>(gpt3Endpoint.chatCompletion(messages, "askGpt", arkRequest))
                    .get()
                    .getChoices()
                    .get(0)
                    .getMessage()
                    .getContent();


            updateMessageList("assistant", response);

            return response;
        }

        @PostMapping("/planner")
        public ResponseEntity<String> planner(ArkRequest arkRequest) {
            String prompt = arkRequest.getBody().getString("prompt");

            loader.put("query", new JsonnetArgs(DataType.STRING, prompt))).loadOrReload();
            logger.info(loader.get("prompt"));

            messages.add(new ChatMessage("system", loader.get("prompt")));
            updateMessageList("user", prompt);

            String response = new EdgeChain<>(gpt3Endpoint.chatCompletion(messages, "planner", loader, arkRequest))
                    .get()
                    .getChoices()
                    .get(0)
                    .getMessage()
                    .getContent();

            updateMessageList("assistant", response);

            return ResponseEntity.ok(response);
        }

        private void updateMessageList(String role, String content) {
            messages.add(new ChatMessage(role, content));

            if (messages.size() > 20) {
                messages.remove(0);
            }
        }
    }
}