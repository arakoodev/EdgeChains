package com.edgechain;

//DEPS org.springframework.boot:spring-boot-starter-thymeleaf:3.1.0

//FILES templates/index.html=resources/templates/index.html
//FILES templates/fragments.html=resources/templates/fragments.html

import com.edgechain.lib.context.domain.HistoryContext;
import com.edgechain.lib.endpoint.impl.context.PostgreSQLHistoryContextEndpoint;
import com.edgechain.lib.endpoint.impl.index.PostgresEndpoint;
import com.edgechain.lib.endpoint.impl.llm.OpenAiChatEndpoint;
import com.edgechain.lib.jsonnet.JsonnetArgs;
import com.edgechain.lib.jsonnet.JsonnetLoader;
import com.edgechain.lib.jsonnet.enums.DataType;
import com.edgechain.lib.jsonnet.impl.FileJsonnetLoader;
import com.edgechain.lib.request.ArkRequest;
import com.edgechain.lib.rxjava.retry.impl.ExponentialDelay;
import com.edgechain.lib.rxjava.retry.impl.FixedDelay;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import jakarta.servlet.http.HttpServletRequest;
import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.http.*;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.*;
import java.util.concurrent.TimeUnit;

import static com.edgechain.lib.constants.EndpointConstants.OPENAI_CHAT_COMPLETION_API;

@SpringBootApplication
public class ChatBot {

    private static final String OPENAI_AUTH_KEY = ""; // YOUR OPENAI KEY
    private static final String OPENAI_ORG_ID = ""; // YOUR OPENAI KEY
    private static OpenAiChatEndpoint gpt3Endpoint;
    private static PostgresEndpoint postgresEndpoint;
    private static PostgreSQLHistoryContextEndpoint contextEndpoint;
    private static final JsonnetLoader promptLoader = new FileJsonnetLoader("planner.jsonnet"); // JSONNET FILE PATH
    //    private static final JsonnetLoader updateLoader = new FileJsonnetLoader("update.jsonnet"); // JSONNET FILE PATH
    private static final JsonnetLoader routerLoader = new FileJsonnetLoader("router.jsonnet"); // JSONNET FILE PATH
    private static final JsonnetLoader stringManp = new FileJsonnetLoader("string_manp.jsonnet"); // STRING MANIPULATION JSONNET FILE PATH

    public static void main(String[] args) {

        System.setProperty("server.port", "8080");
        Properties properties = new Properties();

        properties.setProperty("postgres.db.host", "");
        properties.setProperty("postgres.db.username", "");
        properties.setProperty("postgres.db.password", "");

        new SpringApplicationBuilder(ChatBot.class).properties(properties).run(args);

        gpt3Endpoint = new OpenAiChatEndpoint(
                OPENAI_CHAT_COMPLETION_API,
                OPENAI_AUTH_KEY,
                OPENAI_ORG_ID,
                "gpt-3.5-turbo",
                "user",
                0.5,
                new ExponentialDelay(3, 5, 2, TimeUnit.SECONDS)
        );

        postgresEndpoint = new PostgresEndpoint(new FixedDelay(3, 3, TimeUnit.SECONDS));

        contextEndpoint = new PostgreSQLHistoryContextEndpoint(new FixedDelay(2, 3, TimeUnit.SECONDS));
    }

    @RestController
    @RequestMapping("/v1")
    public static class RootController {
        Logger logger = LoggerFactory.getLogger(getClass());

        @PostMapping("/assistant")
        public ResponseEntity<String> getCustomer(ArkRequest arkRequest) {
            String query = arkRequest.getBody().getString("prompt");
            String historyContextId = arkRequest.getQueryParam("id");

            HistoryContext historyContext = contextEndpoint.get(historyContextId);

            logger.info("\n\n<------CONVERSATION HISTORY------>\n\n{}\n\n", historyContext.getResponse());

            promptLoader
                    .put("query", new JsonnetArgs(DataType.STRING, query))
                    .put("history", new JsonnetArgs(DataType.STRING, historyContext.getResponse()))
                    .loadOrReload();

//            String finalPrompt = chatFn(historyContext.getResponse());

            String finalPrompt = promptLoader.get("prompt");
            // Calling GPT
            String finalResponse = getGptResponse(gpt3Endpoint, finalPrompt, arkRequest);
            logger.info("\n\n<------GPT RESPONSE------>\n\n{}\n\n", finalResponse);

            // Preparing conversation history
            try {
                stringManp
                        .put("str1", new JsonnetArgs(DataType.STRING, query))
                        .put("str2", new JsonnetArgs(DataType.STRING, finalResponse))
                        .put("str3", new JsonnetArgs(DataType.STRING, historyContext.getResponse()))
                        .loadOrReload();
            } catch (Exception e) {
                logger.info("<------string_manp jsonnet error message------> {}\n", e.getMessage());
            }

            String finalConversationHistory = stringManp.get("final_string");

            contextEndpoint.put(historyContext.getId(), finalConversationHistory);


//            apiLoader.put("finalResponse", new JsonnetArgs(DataType.STRING, finalResponse)).loadOrReload();

            // Getting result from GPT response
//            String gptResult = promptLoader.get("result");
//            logger.info("Extracted result from GPT result {} ", gptResult);

//            if (gptResult.isEmpty() && !gptResult.matches("\\d+")) {
//                return ResponseEntity.ok(null);
//            } else {
//                ResponseEntity<String> customerDetails = getCustomerApi(gptResult);
//                logger.info("customer details \n {} \n", customerDetails);
//                return customerDetails;
//            }

            return ResponseEntity.ok(null);
        }

        @PostMapping("/openai/route")
        public Mono router(ArkRequest arkRequest) {
            JSONObject body = arkRequest.getBody();
            String query = body.getString("query");
            System.out.println("\n arkReq before:" + body);
            //Get the prompts
            promptLoader.loadOrReload();

            String routerPrompt = promptLoader.get("router_prompt");
            String queryChoice = promptLoader.get("query_choice");
            String summaryChoice = promptLoader.get("summary_choice");
//        System.out.println("\n AFTER PROMPT loader! \n");
            List<String> choices = List.of(queryChoice, summaryChoice);
            routerLoader
                    .put("query", new JsonnetArgs(DataType.STRING, query))
                    .put("numChoices", new JsonnetArgs(DataType.STRING, choices.size() + ""))
                    .put("contextList", new JsonnetArgs(DataType.STRING, choices.toString()))
                    .put("promptTemplate", new JsonnetArgs(DataType.STRING, routerPrompt))
                    .put("gptResponse", new JsonnetArgs(DataType.STRING, ""))
                    .put("flag", new JsonnetArgs(DataType.STRING, "false"))
                    .loadOrReload();
            String formattedPrompt = routerLoader.get("formattedPrompt");
//            String gptResponse = getGptResponse(gpt3Endpoint, formattedPrompt, arkRequest);
//            System.out.println("\n\ngptResponse:" + gptResponse);

//            routerLoader
//                    .put("gptResponse", new JsonnetArgs(DataType.STRING, gptResponse))
//                    .put("flag", new JsonnetArgs(DataType.STRING, "true"))
//                    .loadOrReload();
//            int choiceNum = Integer.parseInt(routerLoader.get("choiceNum"));
//            System.out.println("\nchoice num:" + choiceNum);
            System.out.println("\n arkReq later:" + body);
            return null;
            //Call the particular methods
//        switch (choiceNum) {
//            case 1 -> {
//                return webClient().post()
//                        .uri("http://localhost:8080/v1/openai/query-rrf?topK=20")
//                        .contentType(MediaType.APPLICATION_JSON)
//                        .bodyValue(body.toString())
//                        .retrieve()
//                        .bodyToMono(String.class)
//                        .map(s -> new JSONObject(s).toMap());
//            }
//            case 2 -> {
//                return webClient().post()
//                        .uri("http://localhost:8080/v1/openai/summarize?topK=8")
//                        .contentType(MediaType.APPLICATION_JSON)
//                        .bodyValue(body.toString())
//                        .retrieve()
//                        .bodyToMono(String.class)
//                        .map(s -> new JSONObject(s).toMap());
//            }
//            default -> {
//                return null;
//            }
//        }
        }

        private ResponseEntity<String> customerApiCall(String paramValue) {
            String URL = ""; // API URL
            String privateKey = ""; // API KEY

            RestTemplate restTemplate = new RestTemplate();

            HttpHeaders headers = new HttpHeaders();
            headers.set("APIKey", privateKey);

            HttpEntity<Object> entity = new HttpEntity<>(headers);

            Map<String, String> param = Collections.singletonMap("phoneNumber", paramValue);

            return restTemplate.exchange(URL, HttpMethod.GET, entity, String.class, param);
        }

        private String getGptResponse(OpenAiChatEndpoint endpoint, String messages, ArkRequest arkRequest) {
            return new EdgeChain<>(endpoint.chatCompletion(messages, "planner", arkRequest))
                    .get()
                    .getChoices()
                    .get(0)
                    .getMessage()
                    .getContent();
        }

        public String chatFn(String chatHistory) {
            promptLoader
                    .put("keepHistory", new JsonnetArgs(DataType.BOOLEAN, "true"))
                    .put("history", new JsonnetArgs(DataType.STRING, chatHistory))
                    .loadOrReload();

            return promptLoader.get("prompt");
        }

    }

    @Controller
    public static class UIController {
        String sessionID = null;
        String historyContext = "";

        public WebClient webClient() {
            return WebClient.builder()
                    .build();
        }

        @GetMapping("/")
        public String index() {
            sessionID = UUID.randomUUID().toString();
            System.out.println("-------- session id ---------\n" + sessionID + "\n");
            if (!historyContext.isEmpty()) contextEndpoint.delete(historyContext);
            return "index5";
        }

        @GetMapping("/query")
        public String query(HttpServletRequest request, Model model) {

            String URI = "http://localhost:8080/ask";
            String HISTORY_CONTEXT_URI = "http://localhost:8080/v1/postgresql/historycontext";


            // Create history context in PG by calling "localhost:8080/v1/postgresql/historycontext"
            if (historyContext.isEmpty()) {
                try {
                    historyContext = Objects.requireNonNull(webClient().post()
                                    .uri(HISTORY_CONTEXT_URI)
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .retrieve()
                                    .bodyToMono(HistoryContext.class)
                                    .block())
                            .getId();
                    URI = URI + "?id=" + historyContext;
                } catch (Exception e) {
                    e.printStackTrace();
                }
            } else {
                URI = URI + "?id=" + historyContext;
            }

            if (request.getParameter("query") == null) throw new RuntimeException("Json object is null");

            String userQuery = request.getParameter("query");

            JSONObject jsonObject = new JSONObject();
            jsonObject.put("prompt", userQuery);


            try {
                String res = webClient().post()
                        .uri(URI)
                        .contentType(MediaType.APPLICATION_JSON)
                        .bodyValue(jsonObject.toString())
                        .retrieve()
                        .bodyToMono(String.class)
                        .block();

                ChatItem chatItem = new ChatItem(userQuery, res);
                model.addAttribute("item", chatItem);

            } catch (Exception e) {
                e.printStackTrace();
            }


            return "fragments :: messageItem";
        }
    }

    public static class ChatItem {
        private String user;
        private String aiResponse;

        public ChatItem(String user, String aiResponse) {
            this.user = user;
            this.aiResponse = aiResponse;
        }

        public String getUser() {
            return user;
        }

        public void setUser(String user) {
            this.user = user;
        }

        public String getAiResponse() {
            return aiResponse;
        }

        public void setAiResponse(String aiResponse) {
            this.aiResponse = aiResponse;
        }
    }
}