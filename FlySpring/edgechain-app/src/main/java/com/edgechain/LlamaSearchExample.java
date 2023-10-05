package com.edgechain;

//DEPS org.springframework.boot:spring-boot-starter-thymeleaf:3.1.0

//FILES templates/index.html=resources/templates/index.html
//FILES templates/fragments.html=resources/templates/fragments.html
//FILES templates/signIn.html=resources/templates/signIn.html
//FILES templates/signUp.html=resources/templates/signUp.html
//FILES templates/arakoo.png=resources/templates/arakoo-01.png

import com.edgechain.lib.configuration.domain.AuthFilter;
import com.edgechain.lib.configuration.domain.MethodAuthentication;
import com.edgechain.lib.endpoint.impl.embeddings.BgeSmallEndpoint;
import com.edgechain.lib.endpoint.impl.index.PostgresEndpoint;
import com.edgechain.lib.endpoint.impl.llama2.Llama2Endpoint;
import com.edgechain.lib.index.domain.PostgresWordEmbeddings;
import com.edgechain.lib.index.domain.RRFWeight;
import com.edgechain.lib.index.enums.BaseWeight;
import com.edgechain.lib.index.enums.OrderRRFBy;
import com.edgechain.lib.index.enums.PostgresDistanceMetric;
import com.edgechain.lib.index.enums.PostgresLanguage;
import com.edgechain.lib.jsonnet.JsonnetArgs;
import com.edgechain.lib.jsonnet.JsonnetLoader;
import com.edgechain.lib.jsonnet.enums.DataType;
import com.edgechain.lib.jsonnet.impl.FileJsonnetLoader;
import com.edgechain.lib.request.ArkRequest;
import com.edgechain.lib.response.ArkResponse;
import com.edgechain.lib.rxjava.retry.impl.ExponentialDelay;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import com.edgechain.lib.utils.ContextReorder;
import jakarta.servlet.http.HttpServletRequest;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.ArrayList;
import java.util.List;
import java.util.Properties;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@SpringBootApplication
public class LlamaSearchExample {

    private static final String LLAMA2_URL = "https://mgitlon397.execute-api.eu-north-1.amazonaws.com/default/LLaMARequest"; // llama2 API

    private static final String PROMPTS_FILE = "E:\\projects\\arakoo\\EdgeChains\\FlySpring\\edgechain-app\\src\\main\\java\\com\\edgechain\\prompts.jsonnet";
    private static final String LLAMA_FILE = "E:\\projects\\arakoo\\EdgeChains\\FlySpring\\edgechain-app\\src\\main\\java\\com\\edgechain\\llama.jsonnet";

    /**
     * LLM Endpoints
     */
    private static Llama2Endpoint llama2Endpoint;

//    private static OpenAiChatEndpoint gpt3WithNParams;

    /**
     * PostgresEndpoint
     */
    private static PostgresEndpoint bgePostgresEndpoint;
    private static final int probes = 40;

    private static final int nParams = 6;
    private static final int upperLimit = 15;


    public static void main(String[] args) {
        System.setProperty("server.port", "8080");

        Properties properties = new Properties();

        properties.setProperty("postgres.db.host", "jdbc:postgresql://db.xhghcwmgziieyjkzrklf.supabase.co:5432/postgres");
        properties.setProperty("postgres.db.username", "postgres");
        properties.setProperty("postgres.db.password", "E.@A@m&7h!B3i2n");

        new SpringApplicationBuilder(LlamaSearchExample.class).properties(properties).run(args);


        llama2Endpoint =
                new Llama2Endpoint(
                        LLAMA2_URL,
                        new ExponentialDelay(3, 5, 2, TimeUnit.SECONDS),
                        0.7,
                        50,
                        0.6,
                        true,
                        512,
                        1.2,
                        List.of("</s>")
                );

        BgeSmallEndpoint bgeSmallEndpoint = new BgeSmallEndpoint(
                "https://huggingface.co/Supabase/bge-small-en/resolve/main/onnx/model.onnx",
                "https://huggingface.co/Supabase/bge-small-en/resolve/main/tokenizer.json");

        bgePostgresEndpoint =
                new PostgresEndpoint(
                        "bge_llm_prod", "360_docs",
                        bgeSmallEndpoint, new ExponentialDelay(5, 3, 2, TimeUnit.SECONDS));
    }

    @Bean
    @Primary
    public AuthFilter authFilter() {
        AuthFilter filter = new AuthFilter();
        filter.setRequestPost(
                new MethodAuthentication(
                        List.of(
                                "/v1/postgresql/historycontext",
                                "/v1/logs/jsonnet/**",
                                "/v1/logs/embeddings/**",
                                "/v1/logs/chat/**"),
                        "authenticated")); // define multiple roles by comma
        filter.setRequestGet(
                new MethodAuthentication(
                        List.of(
                                "/v1/postgresql/historycontext",
                                "/v1/logs/jsonnet/**",
                                "/v1/logs/embeddings/**",
                                "/v1/logs/chat/**"),
                        "authenticated"));
        filter.setRequestDelete(
                new MethodAuthentication(
                        List.of("/v1/postgresql/historycontext", "/v1/postgres/deleteAll"), "authenticated"));
        filter.setRequestPut(
                new MethodAuthentication(List.of("/v1/postgresql/historycontext"), "authenticated"));
        filter.setRequestPatch(new MethodAuthentication(List.of("**"), "authenticated"));
        return filter;
    }

    @RestController
    @RequestMapping("/v1")
    public class LlamSearchController {

        @Autowired
        private ContextReorder contextReorder;

        @PostMapping("/bge/query-rrf")
        public ArkResponse queryRRFBge(ArkRequest arkRequest) {
            JSONObject body = arkRequest.getBody();

            int topK = arkRequest.getIntQueryParam("topK");
            String metadataTable = body.getString("metadataTable");
            String query = body.getString("query");

            JSONObject textWeight = body.getJSONObject("textWeight");
            BaseWeight textBaseWeight = BaseWeight.fromDouble(textWeight.getDouble("baseWeight"));
            double textFineTuneWeight = textWeight.getDouble("fineTuneWeight");

            JSONObject similarityWeight = body.getJSONObject("similarityWeight");
            BaseWeight similarityBaseWeight =
                    BaseWeight.fromDouble(similarityWeight.getDouble("baseWeight"));
            double similarityFineTuneWeight = similarityWeight.getDouble("fineTuneWeight");

            JSONObject dateWeight = body.getJSONObject("dateWeight");
            BaseWeight dateBaseWeight = BaseWeight.fromDouble(dateWeight.getDouble("baseWeight"));
            double dateFineTuneWeight = dateWeight.getDouble("fineTuneWeight");

            OrderRRFBy orderRRF = OrderRRFBy.fromString(body.getString("orderRRF"));
            JsonnetLoader promptLoader = new FileJsonnetLoader(PROMPTS_FILE);
            JsonnetLoader llamaLoader = new FileJsonnetLoader(LLAMA_FILE);

            EdgeChain<List<PostgresWordEmbeddings>> wordEmbeddingsChain =
                    new EdgeChain<>(
                            bgePostgresEndpoint.queryRRF(
                                    metadataTable,
                                    List.of(query),
                                    new RRFWeight(textBaseWeight, textFineTuneWeight),
                                    new RRFWeight(similarityBaseWeight, similarityFineTuneWeight),
                                    new RRFWeight(dateBaseWeight, dateFineTuneWeight),
                                    orderRRF,
                                    query,
                                    PostgresLanguage.ENGLISH,
                                    probes,
                                    PostgresDistanceMetric.IP,
                                    topK,
                                    upperLimit,
                                    arkRequest))
                            .transform(w -> contextReorder.reorderPostgresWordEmbeddings(w));

            return new EdgeChain<>(wordEmbeddingsChain.get())
                    .transform(
                            wordEmbeddings -> {
                                List<String> strings =
                                        wordEmbeddings.stream()
                                                .map(
                                                        s ->
                                                                s.getRawText()
                                                                        .strip()
                                                                        .concat(" ")
                                                                        .concat("Score: ")
                                                                        .concat(String.valueOf(s.getScore()))
                                                                        .concat(" "))
                                                .toList();

                                String context = String.join("\\n ", strings);

                                System.out.println("\n\nbefore load\n\n");
                                try {
                                    promptLoader.loadOrReload();
                                } catch (Exception e) {
                                    e.printStackTrace();
                                }

                                System.out.println("after load jsonnet");

                                // System prompt
                                String llamaSystemPromptTemplate = promptLoader.get("llama2_system_prompt");
                                System.out.println("\n\n\nllamaSystemPromptTemplate>>>" + llamaSystemPromptTemplate);
                                llamaLoader
                                        .put(
                                                "promptTemplate",
                                                new JsonnetArgs(DataType.STRING, llamaSystemPromptTemplate))
                                        .put("query", new JsonnetArgs(DataType.STRING, context))
                                        .loadOrReload();
                                String finalPromptSystem = llamaLoader.get("prompt");

                                // user prompt
                                String llamaUserPromptTemplate = promptLoader.get("llama_user_prompt");
                                System.out.println("\n\n\nllamaUserPromptTemplate>>>" + llamaUserPromptTemplate);
                                llamaLoader
                                        .put("promptTemplate", new JsonnetArgs(DataType.STRING, llamaUserPromptTemplate))
                                        .put("query", new JsonnetArgs(DataType.STRING, query))
                                        .loadOrReload();
                                String finalPromptUser = llamaLoader.get("prompt");

                                //getting errors
                                System.out.println("\n\n\nfinalPromptUser>>>" + finalPromptUser);

                                StringBuilder sb = new StringBuilder();
                                sb.append(finalPromptSystem);
                                //TODO: OpennAI -> LLAMA2
                                String chatMessages = "";
//                                chatMessages.add(new ChatMessage("system", sb.toString()));
                                chatMessages += String.valueOf(sb);
                                chatMessages += String.valueOf(finalPromptUser);
//                                chatMessages.add(new ChatMessage("user", finalPromptUser));

                                System.out.println("\n\n chat message>>>" + chatMessages);

                                String finalAnswer = llama2fn(llama2Endpoint, chatMessages, arkRequest);
                                System.out.println("\n\n final answer message>>>" + finalAnswer);


                                JSONObject json = new JSONObject();
                                json.put("wordEmbeddings", wordEmbeddings);
                                json.put("finalAnswer", finalAnswer);
                                return json.toMap();
                            })
                    .getArkResponse();
        }

        /**
         * Private Methods *
         */
        private String llama2fn(
                Llama2Endpoint endpoint, String chatMessages, ArkRequest arkRequest) {
            return new EdgeChain<>(endpoint.chatCompletion(chatMessages, "promptChain", arkRequest))
                    .get()
                    .getResponses()
                    .get(0)
                    .getGeneratedText();
        }

    }

    @Controller
    @RequestMapping("/")
    public class DashboardController {
        public WebClient webClient() {
            return WebClient.builder()
                    .codecs(configurer -> configurer.defaultCodecs().maxInMemorySize(5 * 1024 * 1024))
                    .build();
        }

        @GetMapping
        public String index(Model model, HttpServletRequest request) {
            request.getSession().setAttribute("access_token", request.getParameter("access_token"));
            return "index";
        }

        @GetMapping("login")
        public String logIn() {
            return "signIn";
        }

        @GetMapping("signup")
        public String singUp() {
            return "signUp";
        }

        @GetMapping("signinlink")
        public String signInLink() {
            return "signInLink";
        }

        @GetMapping("logout")
        public String logOut(HttpServletRequest request) {
            request.getSession().setAttribute("access_token", null);
            return "redirect:/login";
        }

        @GetMapping("/search")
        public String search(Model model, HttpServletRequest request) {

            String uri = "http://localhost:8080/v1";
            if (request.getParameter("embeddings").equals("bgeSmall_rrf")) {
                uri += "/bge/query-rrf?topK=20";
            }

            // Validations for FineTuneWeight
            if (request.getParameter("embeddings").equals("bgeSmall_rrf")) {
                String patternString = "^(0\\.\\d*[1-9]+\\d*|0\\.\\d*[1-9]|0)$";
                Pattern pattern = Pattern.compile(patternString);

                String textFineTuneWeight = request.getParameter("textFineTuneWeight");
                String similarityFineTuneWeight = request.getParameter("similarityFineTuneWeight");
                String dateFineTuneWeight = request.getParameter("dateFineTuneWeight");

                Matcher matcherText = pattern.matcher(textFineTuneWeight);
                Matcher matcherSimilarity = pattern.matcher(similarityFineTuneWeight);
                Matcher matcherDate = pattern.matcher(dateFineTuneWeight);

                if (!matcherText.matches() || !matcherSimilarity.matches() || !matcherDate.matches()) {
                    model.addAttribute("error", "Please enter FineTuneWeight value between 0 and 1");
                    return "fragments";
                }
            }

            JSONObject queryJson = new JSONObject();
            queryJson.put("query", request.getParameter("query"));

            if (request.getParameter("embeddings").equals("bgeSmall_rrf")) {
                // Text weight
                JSONObject textWeight = new JSONObject();
                textWeight.put("baseWeight", request.getParameter("textBaseWeight"));
                textWeight.put("fineTuneWeight", request.getParameter("textFineTuneWeight"));
                queryJson.put("textWeight", textWeight);

                // Similarity Weight
                JSONObject similarityWeight = new JSONObject();
                similarityWeight.put("baseWeight", request.getParameter("similarityBaseWeight"));
                similarityWeight.put("fineTuneWeight", request.getParameter("similarityFineTuneWeight"));
                queryJson.put("similarityWeight", similarityWeight);

                // Date weight
                JSONObject dateWeight = new JSONObject();
                dateWeight.put("baseWeight", request.getParameter("dateBaseWeight"));
                dateWeight.put("fineTuneWeight", request.getParameter("dateFineTuneWeight"));
                queryJson.put("dateWeight", dateWeight);

                queryJson.put("orderRRF", request.getParameter("orderRRF"));
                queryJson.put("metadataTable", request.getParameter("metadataTable"));
            }
            try {

                JSONObject llamaJson =
                        webClient()
                                .post()
                                .uri(uri)
                                .contentType(MediaType.APPLICATION_JSON)
                                .bodyValue(queryJson.toString())
                                .retrieve()
                                .bodyToMono(String.class)
                                .map(JSONObject::new)
                                .block();
                JSONArray jsonArray = llamaJson.getJSONArray("wordEmbeddings");

                List<PostgresWordEmbeddings> postgresWordEmbeddingsList = new ArrayList<>();

                for (int i = 0; i < jsonArray.length(); i++) {

                    JSONObject jsonObject = jsonArray.getJSONObject(i);
                    PostgresWordEmbeddings e = new PostgresWordEmbeddings();
                    e.setRawText(jsonObject.getString("rawText"));
                    e.setScore(jsonObject.getDouble("score"));
                    if (jsonObject.has("filename")) {
                        e.setFilename(jsonObject.getString("filename"));
                    }

                    if (jsonObject.has("titleMetadata")) {
                        e.setTitleMetadata(jsonObject.getString("titleMetadata"));
                    }
                    if (jsonObject.has("documentDate")) {
                        e.setDocumentDate(jsonObject.getString("documentDate"));
                    }
                    if (jsonObject.has("metadata")) {
                        e.setMetadata(jsonObject.getString("metadata"));
                    }
                    postgresWordEmbeddingsList.add(e);
                }

                model.addAttribute("responses", postgresWordEmbeddingsList);
                model.addAttribute("final_answer", llamaJson.getString("finalAnswer"));
            } catch (Exception e) {
                e.printStackTrace();
            }
            return "fragments :: responseList";
        }
    }
}
