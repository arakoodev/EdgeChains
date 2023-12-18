package com.edgechain;

import com.edgechain.lib.chains.PostgresRetrieval;
import com.edgechain.lib.context.domain.HistoryContext;
import com.edgechain.lib.embeddings.miniLLM.enums.MiniLMModel;
import com.edgechain.lib.endpoint.impl.context.PostgreSQLHistoryContextEndpoint;
import com.edgechain.lib.endpoint.impl.embeddings.MiniLMEndpoint;
import com.edgechain.lib.endpoint.impl.index.PostgresEndpoint;
import com.edgechain.lib.endpoint.impl.llm.OpenAiChatEndpoint;
import com.edgechain.lib.index.domain.PostgresWordEmbeddings;
import com.edgechain.lib.index.enums.PostgresDistanceMetric;
import com.edgechain.lib.index.enums.PostgresLanguage;
import com.edgechain.lib.jsonnet.JsonnetArgs;
import com.edgechain.lib.jsonnet.JsonnetLoader;
import com.edgechain.lib.jsonnet.enums.DataType;
import com.edgechain.lib.jsonnet.impl.FileJsonnetLoader;
import com.edgechain.lib.openai.response.ChatCompletionResponse;
import com.edgechain.lib.reader.impl.PdfReader;
import com.edgechain.lib.request.ArkRequest;
import com.edgechain.lib.response.ArkResponse;
import com.edgechain.lib.rxjava.retry.impl.ExponentialDelay;
import com.edgechain.lib.rxjava.retry.impl.FixedDelay;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Properties;
import java.util.concurrent.TimeUnit;

import static com.edgechain.lib.constants.EndpointConstants.OPENAI_CHAT_COMPLETION_API;

@SpringBootApplication
public class SupabaseMiniLMExample {
  private static final String OPENAI_AUTH_KEY = ""; // YOUR OPENAI AUTH KEY
  private static final String OPENAI_ORG_ID = ""; // YOUR OPENAI ORG ID

  private static OpenAiChatEndpoint gpt3Endpoint;
  private static OpenAiChatEndpoint gpt3StreamEndpoint;
  private static PostgresEndpoint postgresEndpoint;
  private static PostgreSQLHistoryContextEndpoint contextEndpoint;

  private JsonnetLoader queryLoader =
      new FileJsonnetLoader("./supabase-miniLM/postgres-query.jsonnet");
  private JsonnetLoader chatLoader =
      new FileJsonnetLoader("./supabase-miniLM/postgres-chat.jsonnet");

  public static void main(String[] args) {

    System.setProperty("server.port", "8080");

    // Optional, if you are using supabase for authentication
    Properties properties = new Properties();
    properties.setProperty("supabase.url", "");
    properties.setProperty("supabase.annon.key", "");

    // For JWT decode
    properties.setProperty("jwt.secret", "");

    // Adding Cors ==> You can configure multiple cors w.r.t your urls.;
    properties.setProperty("cors.origins", "http://localhost:4200");

    // Should only be used in dev environment
    properties.setProperty("spring.jpa.show-sql", "true");
    properties.setProperty("spring.jpa.properties.hibernate.format_sql", "true");

    // For DB config
    properties.setProperty("postgres.db.host", "");
    properties.setProperty("postgres.db.username", "postgres");
    properties.setProperty("postgres.db.password", "");

    new SpringApplicationBuilder(SupabaseMiniLMExample.class).properties(properties).run(args);

    gpt3Endpoint =
        new OpenAiChatEndpoint(
            OPENAI_CHAT_COMPLETION_API,
            OPENAI_AUTH_KEY,
            OPENAI_ORG_ID,
            "gpt-3.5-turbo",
            "user",
            0.85,
            new ExponentialDelay(3, 5, 2, TimeUnit.SECONDS));

    gpt3StreamEndpoint =
        new OpenAiChatEndpoint(
            OPENAI_CHAT_COMPLETION_API,
            OPENAI_AUTH_KEY,
            OPENAI_ORG_ID,
            "gpt-3.5-turbo",
            "user",
            0.85,
            true,
            new ExponentialDelay(3, 5, 2, TimeUnit.SECONDS));

    // Creating MiniLM Endpoint
    // When endpoint.embeddings() is called; it will look for the model; if not available, it will
    // download on fly.
    // All the requests will wait until the model is download & loaded once into the application...
    // As you can see, the model is not download; so it will download on fly...
    MiniLMEndpoint miniLMEndpoint = new MiniLMEndpoint(MiniLMModel.ALL_MINILM_L12_V2);

    // Creating PostgresEndpoint ==> We create a new table because miniLM supports 384 dimensional
    // vectors;
    postgresEndpoint =
        new PostgresEndpoint(
            "minilm_vectors",
            "minilm-ns",
            miniLMEndpoint,
            new ExponentialDelay(2, 3, 2, TimeUnit.SECONDS));

    contextEndpoint = new PostgreSQLHistoryContextEndpoint(new FixedDelay(2, 3, TimeUnit.SECONDS));
  }

  /**
   * By Default, every API is unauthenticated & exposed without any sort of authentication; To
   * authenticate, your custom APIs in Controller you would need @PreAuthorize(hasAuthority(""));
   * this will authenticate by JWT having two fields: a) email, b) role To authenticate, internal
   * APIs related to historyContext & Logging, Delete Redis/Postgres we need to create bean of
   * AuthFilter; you can uncomment the code. Note, you need to define "jwt.secret" property as well
   * to decode accessToken.
   */
  //  @Bean
  //  @Primary
  //  public AuthFilter authFilter() {
  //    AuthFilter filter = new AuthFilter();
  //    // new MethodAuthentication(List.of(APIs), roles)
  //    filter.setRequestPost(new MethodAuthentication(List.of("/v1/postgresql/historycontext"),
  // "authenticated")); // define multiple roles by comma
  //    filter.setRequestGet(new MethodAuthentication(List.of(""), ""));
  //    filter.setRequestDelete(new MethodAuthentication(List.of(""), ""));
  //    filter.setRequestPatch(new MethodAuthentication(List.of(""), ""));
  //    filter.setRequestPut(new MethodAuthentication(List.of(""), ""));
  //    return filter;
  //  }

  @RestController
  public class SupabaseController {

    @Autowired private PdfReader pdfReader;

    // ========== PGVectors ==============

    // Concept of Namespace //
    /*
     * Namespace: VectorDb allows you to partition the vectors in an index into namespaces. Queries
     * and other operations are then limited to one namespace, so different requests can search
     * different subsets of your index. If namespace is null or empty, in pinecone it will be
     * prefixed as "" empty string & in redis it will be prefixed as "knowledge" For example, you
     * might want to define a namespace for indexing books by finance, law, medicine etc.. Can be
     * used in multiple use-cases.... such as User uploading book, generating unique namespace &
     * then querying/chatting with it...
     *
     */

    /**
     * If namespace is empty string or null, then the default namespace is 'knowledge'==> The
     * concept of namespace is defined above *
     */
    @PostMapping("/miniLM/upsert")
    @PreAuthorize("hasAnyAuthority('authenticated')")
    public void upsert(ArkRequest arkRequest) throws IOException {
      String filename = arkRequest.getMultiPart("file").getSubmittedFileName();
      InputStream file = arkRequest.getMultiPart("file").getInputStream();

      String[] arr = pdfReader.readByChunkSize(file, 512);

      PostgresRetrieval retrieval =
          new PostgresRetrieval(
              arr, postgresEndpoint, 384, filename, PostgresLanguage.ENGLISH, arkRequest);

      //   retrieval.setBatchSize(50); // Modifying batchSize....

      // Getting ids from upsertion... Internally, it automatically parallelizes the operation...
      List<String> ids = retrieval.upsert();

      ids.forEach(System.out::println);

      System.out.println("Size: " + ids.size()); // Printing the UUIDs
    }

    @PostMapping(value = "/miniLM/query")
    @PreAuthorize("hasAnyAuthority('authenticated')")
    public ArkResponse queryPostgres(ArkRequest arkRequest) {

      String query = arkRequest.getBody().getString("query");
      int topK = arkRequest.getIntQueryParam("topK");

      //  Chain 2 ==> Query Embeddings from PostgreSQL
      EdgeChain<List<PostgresWordEmbeddings>> queryChain =
          new EdgeChain<>(
              postgresEndpoint.query(
                  List.of(query), PostgresDistanceMetric.L2, topK, topK, arkRequest));

      //  Chain 3 ===> Our queryFn passes takes list and passes each response with base prompt to
      // OpenAI
      EdgeChain<List<ChatCompletionResponse>> gpt3Chain =
          queryChain.transform(wordEmbeddings -> queryFn(wordEmbeddings, arkRequest));

      return gpt3Chain.getArkResponse();
    }

    @PostMapping(value = "/miniLM/chat")
    @PreAuthorize("hasAnyAuthority('authenticated')")
    public ArkResponse chatWithPostgres(ArkRequest arkRequest) {

      String contextId = arkRequest.getQueryParam("id");

      String query = arkRequest.getBody().getString("query");

      boolean stream = arkRequest.getBooleanHeader("stream");

      // Get HistoryContext
      HistoryContext historyContext = contextEndpoint.get(contextId);

      // Load Jsonnet To extract topK query dynamically
      chatLoader
          .put("keepMaxTokens", new JsonnetArgs(DataType.BOOLEAN, "true"))
          .put("maxTokens", new JsonnetArgs(DataType.INTEGER, "4096"))
          .put("query", new JsonnetArgs(DataType.STRING, query))
          .put("keepHistory", new JsonnetArgs(DataType.BOOLEAN, "false"))
          .loadOrReload();

      // Extract topK value from JsonnetLoader;
      int topK = chatLoader.getInt("topK");

      // Chain 1 ==> Query Embeddings from PostgreSQL & Then concatenate it (preparing for prompt)
      // let's say topK=5; then we concatenate List into a string using String.join method
      EdgeChain<List<PostgresWordEmbeddings>> postgresChain =
          new EdgeChain<>(
              postgresEndpoint.query(
                  List.of(query), PostgresDistanceMetric.L2, topK, topK, arkRequest));

      // Chain 3 ===> Transform String of Queries into List<Queries>
      EdgeChain<String> queryChain =
          new EdgeChain<>(postgresChain)
              .transform(
                  postgresResponse -> {
                    List<PostgresWordEmbeddings> postgresWordEmbeddingsList =
                        postgresResponse.get();
                    List<String> queryList = new ArrayList<>();
                    postgresWordEmbeddingsList.forEach(q -> queryList.add(q.getRawText()));
                    return String.join("\n", queryList);
                  });

      // Chain 4 ===> Create fn() to prepare your chat prompt
      EdgeChain<String> promptChain =
          queryChain.transform(queries -> chatFn(historyContext.getResponse(), queries));

      //  (FOR NON STREAMING)
      // If it's not stream ==>
      // Query(What is the collect stage for data maturity) + OpenAiResponse + Prev. ChatHistory
      if (!stream) {

        // Chain 5 ==> Pass the Prompt To Gpt3
        EdgeChain<ChatCompletionResponse> gpt3Chain =
            new EdgeChain<>(
                gpt3Endpoint.chatCompletion(
                    promptChain.get(), "MiniLMPostgresChatChain", arkRequest));

        // Chain 6
        EdgeChain<ChatCompletionResponse> historyUpdatedChain =
            gpt3Chain.doOnNext(
                chatResponse ->
                    contextEndpoint.put(
                        historyContext.getId(),
                        query
                            + chatResponse.getChoices().get(0).getMessage().getContent()
                            + historyContext.getResponse()));

        return historyUpdatedChain.getArkResponse();
      }

      // For STREAMING Version
      else {

        // Chain 5 ==> Pass the Prompt To Gpt3
        EdgeChain<ChatCompletionResponse> gpt3Chain =
            new EdgeChain<>(
                gpt3StreamEndpoint.chatCompletion(
                    promptChain.get(), "MiniLMPostgresChatChain", arkRequest));

        /* As the response is in stream, so we will use StringBuilder to append the response
        and once GPT chain indicates that it is finished, we will save the following into Postgres
         Query(What is the collect stage for data maturity) + OpenAiResponse + Prev. ChatHistory
         */

        StringBuilder stringBuilder = new StringBuilder();

        // Chain 7
        EdgeChain<ChatCompletionResponse> streamingOutputChain =
            gpt3Chain.doOnNext(
                chatResponse -> {
                  if (Objects.isNull(chatResponse.getChoices().get(0).getFinishReason())) {
                    stringBuilder.append(
                        chatResponse.getChoices().get(0).getMessage().getContent());
                  }
                  // Now the streaming response is ended. Save it to DB i.e. HistoryContext
                  else {
                    contextEndpoint.put(
                        historyContext.getId(),
                        query + stringBuilder + historyContext.getResponse());
                  }
                });

        return streamingOutputChain.getArkStreamResponse();
      }
    }

    public List<ChatCompletionResponse> queryFn(
        List<PostgresWordEmbeddings> wordEmbeddings, ArkRequest arkRequest) {

      List<ChatCompletionResponse> resp = new ArrayList<>();

      // Iterate over each Query result; returned from Postgres
      for (PostgresWordEmbeddings wordEmbedding : wordEmbeddings) {

        String query = wordEmbedding.getRawText();

        queryLoader
            .put("keepMaxTokens", new JsonnetArgs(DataType.BOOLEAN, "true"))
            .put("maxTokens", new JsonnetArgs(DataType.INTEGER, "4096"))
            .put("keepContext", new JsonnetArgs(DataType.BOOLEAN, "true"))
            .put(
                "context",
                new JsonnetArgs(
                    DataType.STRING,
                    query)) // Step 3: Concatenate the Prompt: ${Base Prompt} - ${Postgres
            // Output}
            .loadOrReload();
        // Step 4: Now, pass the prompt to OpenAI ChatCompletion & Add it to the list which will be
        // returned
        resp.add(
            new EdgeChain<>(
                    gpt3Endpoint.chatCompletion(
                        queryLoader.get("prompt"), "MiniLMPostgresQueryChain", arkRequest))
                .get());
      }

      return resp;
    }
  }

  public String chatFn(String chatHistory, String queries) {
    chatLoader
        .put("keepHistory", new JsonnetArgs(DataType.BOOLEAN, "true"))
        .put(
            "history",
            new JsonnetArgs(DataType.STRING, chatHistory)) // Getting ChatHistory from Mapper
        .put("keepContext", new JsonnetArgs(DataType.BOOLEAN, "true"))
        .put("context", new JsonnetArgs(DataType.STRING, queries)) // Getting Queries from Mapper
        .loadOrReload(); // Step 5: Pass the Args & Reload Jsonnet

    return chatLoader.get("prompt");
  }
}
