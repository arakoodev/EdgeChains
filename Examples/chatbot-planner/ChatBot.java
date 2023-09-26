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
    private static OpenAiEndpoint gpt3Endpoint;
    private static PostgresEndpoint postgresEndpoint;
    private static PostgreSQLHistoryContextEndpoint contextEndpoint;
    private static JsonnetLoader loader = new FileJsonnetLoader("./chatbot-planner/store-planner.jsonnet"); // JSONNET FILE PATH


    public static void main(String[] args) {
        System.setProperty("server.port", "8080");


        Properties properties = new Properties();

        properties.setProperty("spring.jpa.show-sql", "true");
        properties.setProperty("spring.jpa.properties.hibernate.format_sql", "true");

        // Adding Cors ==> You can configure multiple cors w.r.t your urls.;
        properties.setProperty("cors.origins", "http://localhost:4200");

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

        // Defining tablename and namespace...
        postgresEndpoint =
                new PostgresEndpoint(
                        "pg_vectors", "movie",
                        new ExponentialDelay(5, 5, 2, TimeUnit.SECONDS));

        contextEndpoint = new PostgreSQLHistoryContextEndpoint(new FixedDelay(2, 3, TimeUnit.SECONDS));
    }


    @RestController
    @RequestMapping
    public class Bot {
        Logger logger = LoggerFactory.getLogger(getClass());

        @PostMapping("/planner")
        public ResponseEntity<String> chatBotPlanner(ArkRequest arkRequest) {
            String resourceURL = "";
            boolean delete = false;
            String contextId = arkRequest.getQueryParam("id");
            String prompt = arkRequest.getBody().getString("prompt");

            HistoryContext historyContext = contextEndpoint.get(contextId);

            plannerLoader.put("query", new JsonnetArgs(DataType.STRING, prompt))
                    .put("gptResponse", new JsonnetArgs(DataType.STRING, ""))
                    .put("keepHistory", new JsonnetArgs(DataType.BOOLEAN, "false"))
                    .loadOrReload();

            String chatPrompt = chatFn(historyContext.getResponse(), prompt);

            contextEndpoint.put(historyContext.getId(), prompt + historyContext.getResponse());

            String gptResponse = getGptResponse(chatPrompt, arkRequest);

            if (gptResponse.contains("delete")) {
                delete = true;
            }

            logger.info("GPT Response {} ", gptResponse);

            plannerLoader.put("gptResponse", new JsonnetArgs(DataType.STRING, gptResponse)).loadOrReload();

            String gptResult = plannerLoader.get("result");
            logger.info("Extracted result from GPT result {} ", gptResult);
            if (!gptResult.contains("NOT_APPLICABLE")) {
                return doApiCalls(resourceURL, gptResult, delete);
            }

            return ResponseEntity.ok(gptResult);
        }

        private ResponseEntity<String> doApiCalls(String resourceURL, String result, boolean delete) {
            String finalURL = resourceURL + result;

            logger.info("GPT response final URI {} ", finalURL);

            RestTemplate restTemplate = new RestTemplate();

            if (!delete) {
                return restTemplate
                        .getForEntity(finalURL, String.class);
            } else {
                restTemplate.delete(finalURL);
                return ResponseEntity.ok("Deleted");
            }
        }

        private String getGptResponse(String prompt, ArkRequest arkRequest) {
            return new EdgeChain<>(gpt3Endpoint.chatCompletion(prompt, "planner", arkRequest))
                    .get()
                    .getChoices()
                    .get(0)
                    .getMessage()
                    .getContent();
        }

        public String chatFn(String chatHistory, String queries) {
            plannerLoader
                    .put("keepHistory", new JsonnetArgs(DataType.BOOLEAN, "true"))
                    .put("history", new JsonnetArgs(DataType.STRING, chatHistory)) // Getting ChatHistory from Mapper
                    .put("keepContext", new JsonnetArgs(DataType.BOOLEAN, "true"))
                    .put("context", new JsonnetArgs(DataType.STRING, queries)) // Getting Queries from Mapper
                    .loadOrReload(); // Step 5: Pass the Args & Reload Jsonnet

            return plannerLoader.get("prompt");
        }
    }
}