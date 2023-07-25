package com.edgechain;

import static com.edgechain.lib.constants.EndpointConstants.OPENAI_CHAT_COMPLETION_API;
import static com.edgechain.lib.constants.EndpointConstants.OPENAI_EMBEDDINGS_API;

import com.edgechain.lib.chains.PostgresRetrieval;
import com.edgechain.lib.chains.RedisRetrieval;
import com.edgechain.lib.chains.Retrieval;
import com.edgechain.lib.chunk.enums.LangType;
import com.edgechain.lib.configuration.domain.CorsEnableOrigins;
import com.edgechain.lib.configuration.domain.ExcludeMappingFilter;
import com.edgechain.lib.configuration.domain.RedisEnv;
import com.edgechain.lib.configuration.domain.SupabaseEnv;
import com.edgechain.lib.context.domain.HistoryContext;
import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.impl.*;
import com.edgechain.lib.index.enums.PostgresDistanceMetric;
import com.edgechain.lib.index.enums.RedisDistanceMetric;
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

import java.io.IOException;
import java.io.InputStream;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.IntStream;

import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

@SpringBootApplication
public class PostgreSQLExample {

  private final String OPENAI_AUTH_KEY = "";

  public static void main(String[] args) {
    System.setProperty("server.port", "8080");
    SpringApplication.run(PostgreSQLExample.class, args);
  }

  // Adding Cors ==> You can configure multiple cors w.r.t your urls.;
  @Bean
  @Primary
  public CorsEnableOrigins corsEnableOrigins() {
    CorsEnableOrigins origins = new CorsEnableOrigins();
    origins.setOrigins(Arrays.asList("http://localhost:4200", "http://localhost:4201"));
    return origins;
  }

  /* Optional (if you are not using Supabase or PostgreSQL),always create bean with @Primary annotation */
  // If you want to use PostgreSQL only; then just provide dbHost, dbUsername & dbPassword
  @Bean
  @Primary
  public SupabaseEnv supabaseEnv() {
    SupabaseEnv env = new SupabaseEnv();
    env.setUrl(""); // SupabaseURL
    env.setAnnonKey(""); // Supabase AnnonKey
    env.setJwtSecret(""); // Supabase JWTSecret
    env.setDbHost(""); // jdbc:postgresql://${SUPABASE_DB_URK}/postgres
    env.setDbUsername("postgres");
    env.setDbPassword("");
    return env;
  }

  /**
   * Optional, Create it to exclude api calls from filtering; otherwise API calls will filter via
   * ROLE_BASE access *
   */
  @Bean
  @Primary
  public ExcludeMappingFilter mappingFilter() {
    ExcludeMappingFilter mappingFilter = new ExcludeMappingFilter();
    mappingFilter.setRequestPost(List.of("/v1/examples/**"));
    mappingFilter.setRequestGet(List.of("/v1/examples/**"));
    mappingFilter.setRequestDelete(List.of("/v1/examples/**"));
    mappingFilter.setRequestPut(List.of("/v1/examples/**"));
    return mappingFilter;
  }

  @RestController
  @RequestMapping("/v1/examples")
  public class PostgreSQLController {

    @Autowired private PdfReader pdfReader;

    /*** Creating HistoryContext (Using PostgreSQL) Controller ****/
    @PostMapping("/postgresql/historycontext")
    public ArkResponse createPostgreSQLHistoryContext(ArkRequest arkRequest) {

      PostgreSQLHistoryContextEndpoint endpoint =
          new PostgreSQLHistoryContextEndpoint(new FixedDelay(2, 3, TimeUnit.SECONDS));

      return new ArkResponse(
          endpoint.create(
              UUID.randomUUID()
                  .toString())); // Here randomId is generated, you can provide your own ids....
    }

    @PutMapping("/postgresql/historycontext")
    public ArkResponse putPostgreSQLHistoryContext(ArkRequest arkRequest) throws IOException {
      JSONObject json = arkRequest.getBody();

      PostgreSQLHistoryContextEndpoint endpoint =
          new PostgreSQLHistoryContextEndpoint(new FixedDelay(2, 3, TimeUnit.SECONDS));

      return new ArkResponse(endpoint.put(json.getString("id"), json.getString("response")));
    }

    @GetMapping("/postgresql/historycontext")
    public ArkResponse getPostgreSQLHistoryContext(ArkRequest arkRequest) {
      String id = arkRequest.getQueryParam("id");

      PostgreSQLHistoryContextEndpoint endpoint =
          new PostgreSQLHistoryContextEndpoint(new FixedDelay(2, 3, TimeUnit.SECONDS));

      return new ArkResponse(endpoint.get(id));
    }

    @DeleteMapping("/postgresql/historycontext")
    public void deletePostgreSQLHistoryContext(ArkRequest arkRequest) {
      String id = arkRequest.getQueryParam("id");

      PostgreSQLHistoryContextEndpoint endpoint =
          new PostgreSQLHistoryContextEndpoint(new FixedDelay(2, 3, TimeUnit.SECONDS));

      endpoint.delete(id);
    }

    // ========== PGVectors ==============
    /**
     * If namespace is empty string or null, then the default namespace is 'knowledge'==> The
     * concept of namespace is defined above *
     */
    @PostMapping(
        "/postgres/openai/upsert") // /v1/examples/postgres/openai/upsert?tableName=machine-learning
    public void upsertPostgres(ArkRequest arkRequest) throws IOException {

      String table = arkRequest.getQueryParam("table");
      String namespace = arkRequest.getQueryParam("namespace");
      InputStream file = arkRequest.getMultiPart("file").getInputStream();

      PostgresEndpoint postgresEndpoint =
          new PostgresEndpoint(table, namespace, new ExponentialDelay(5, 5, 2, TimeUnit.SECONDS));

      OpenAiEndpoint embeddingEndpoint =
          new OpenAiEndpoint(
              OPENAI_EMBEDDINGS_API,
              OPENAI_AUTH_KEY,
              "text-embedding-ada-002",
              new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

      String[] arr = pdfReader.readByChunkSize(file, 512);

      Retrieval retrieval = new PostgresRetrieval(postgresEndpoint, 1536, embeddingEndpoint);
      IntStream.range(0, arr.length).parallel().forEach(i -> retrieval.upsert(arr[i]));
    }

    //    If namespace is empty string or null, then the default namespace is 'knowledge'; therefore
    // it will query where namespace='knowledge'
    @PostMapping(
        value = "/postgres/openai/query",
        produces = {MediaType.APPLICATION_JSON_VALUE})
    public ArkResponse queryPostgres(ArkRequest arkRequest) {

      String table = arkRequest.getQueryParam("table");
      String namespace = arkRequest.getQueryParam("namespace");
      String query = arkRequest.getBody().getString("query");
      int topK = arkRequest.getIntQueryParam("topK");

      PostgresEndpoint postgresEndpoint =
          new PostgresEndpoint(table, namespace, new FixedDelay(5, 10, TimeUnit.SECONDS));

      OpenAiEndpoint embeddingEndpoint =
          new OpenAiEndpoint(
              OPENAI_EMBEDDINGS_API,
              OPENAI_AUTH_KEY,
              "text-embedding-ada-002",
              new FixedDelay(3, 5, TimeUnit.SECONDS));

      OpenAiEndpoint chatEndpoint =
          new OpenAiEndpoint(
              OPENAI_CHAT_COMPLETION_API,
              OPENAI_AUTH_KEY,
              "gpt-3.5-turbo",
              "user",
              0.7,
              new ExponentialDelay(3, 5, 2, TimeUnit.SECONDS));

      JsonnetLoader loader =
          new FileJsonnetLoader("R:\\Github\\postgres-query.jsonnet")
              .put("keepMaxTokens", new JsonnetArgs(DataType.BOOLEAN, "true"))
              .put("maxTokens", new JsonnetArgs(DataType.INTEGER, "4096"));

      return new EdgeChain<>(
              embeddingEndpoint.getEmbeddings(
                  query)) // Step 1: Generate embedding using OpenAI for provided input
          .transform(
              embeddings ->
                  new EdgeChain<>(
                          postgresEndpoint.query(embeddings, PostgresDistanceMetric.L2, topK))
                      .get()) // Step 2: Block The Observable & Get the result from Pinecone(id,//
          // scores)
          .transform(
              embeddingsQuery -> {
                List<ChatCompletionResponse> resp = new ArrayList<>();

                // Iterate over each Query result; returned from Pinecone
                Iterator<WordEmbeddings> iterator = embeddingsQuery.iterator();
                while (iterator.hasNext()) {

                  String pinecone = iterator.next().getId();

                  loader
                      .put("keepContext", new JsonnetArgs(DataType.BOOLEAN, "true"))
                      .put(
                          "context",
                          new JsonnetArgs(
                              DataType.STRING,
                              pinecone)) // Step 3: Concatenate the Prompt: ${Base Prompt} - //
                      // ${Pinecone Output}
                      .loadOrReload();
                  // Step 4: Now, pass the prompt to OpenAI ChatCompletion & Add it to the list
                  // which will be returned
                  resp.add(
                      EdgeChain.fromObservable(chatEndpoint.getChatCompletion(loader.get("prompt")))
                          .get()); // You can use both new EdgeChain<>() or
                  // EdgeChain.fromObservable()
                  // Wrap the Observable & get the data in a blocking way... Pass the concatenated
                  // prompt to ChatCompletion..
                }
                return resp;
              })
          .getArkResponse();
    }

    @PostMapping(
        value = "/postgres/openai/chat",
        produces = {MediaType.APPLICATION_JSON_VALUE, MediaType.TEXT_EVENT_STREAM_VALUE})
    public ArkResponse chatWithPostgres(ArkRequest arkRequest) {

      String contextId = arkRequest.getQueryParam("id");
      String query = arkRequest.getBody().getString("query");
      String namespace = arkRequest.getQueryParam("namespace");
      String table = arkRequest.getQueryParam("table");
      boolean stream = arkRequest.getBooleanHeader("stream");

      System.out.println(contextId);
      System.out.println(query);
      System.out.println(table);
      System.out.println(stream);

      PostgreSQLHistoryContextEndpoint postgreSQLContextEndpoint =
          new PostgreSQLHistoryContextEndpoint(new FixedDelay(2, 3, TimeUnit.SECONDS));

      HistoryContext historyContext =
          EdgeChain.fromObservable(postgreSQLContextEndpoint.get(contextId)).get();

      // Step 1: Create JsonnetLoader || Pass Args || Load The File;
      JsonnetLoader loader = new FileJsonnetLoader("R:\\Github\\postgres-chat.jsonnet");
      loader
          .put("keepMaxTokens", new JsonnetArgs(DataType.BOOLEAN, "true"))
          .put("maxTokens", new JsonnetArgs(DataType.INTEGER, "4096"))
          .put("query", new JsonnetArgs(DataType.STRING, query))
          .put("keepHistory", new JsonnetArgs(DataType.BOOLEAN, "false"))
          .loadOrReload();

      // Step 2: Create PostgresEndpoint for Query, OpenAIEndpoint for Using Embedding & Chat
      // Service
      PostgresEndpoint postgresEndpoint =
          new PostgresEndpoint(table, namespace, new FixedDelay(5, 10, TimeUnit.SECONDS));

      OpenAiEndpoint embeddingEndpoint =
          new OpenAiEndpoint(
              OPENAI_EMBEDDINGS_API,
              OPENAI_AUTH_KEY,
              "text-embedding-ada-002",
              new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

      OpenAiEndpoint chatEndpoint =
          new OpenAiEndpoint(
              OPENAI_CHAT_COMPLETION_API,
              OPENAI_AUTH_KEY,
              "gpt-3.5-turbo",
              "user",
              0.7,
              stream,
              new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

      // Extract topK value from JsonnetLoader;
      int topK = loader.getInt("topK");

      return new EdgeChain<>(
              embeddingEndpoint.getEmbeddings(
                  query)) // Step 1: Generate embedding using OpenAI for provided input
          .transform(
              embeddings ->
                  EdgeChain.fromObservable(
                          postgresEndpoint.query(embeddings, PostgresDistanceMetric.IP, topK))
                      .get()) // Step 2: Block the Observables &  Get topK queries from Pinecone
          // Iterator over PineconeResponse & Get the ids;
          .transform(
              embeddingsQuery -> { // Step 3: Now, we concatenate/join each query with "\n";
                // let's say topK=5; then we concatenate them and pass to ChatCompletion
                List<String> ids = new ArrayList<>();
                embeddingsQuery.forEach(v -> ids.add(v.getId()));
                // Now Joining it with delimiter (new line i.e, \n)
                return String.join("\n", ids);
              })
          .transform(
              queries -> {
                // Creating HashMap<String,String> to store both my chatHistory & postgresOutput
                // (queries) because I would be needing them in the chains
                HashMap<String, String> mapper = new HashMap<>();
                mapper.put("queries", queries);
                mapper.put("chatHistory", historyContext.getResponse());

                return mapper;
              }) // Step 4: Get the ChatHistory, and then we pass ChatHistory & PostgresOutput to
          // our JsonnetLoader
          .transform(
              mapper -> {
                loader
                    .put("keepHistory", new JsonnetArgs(DataType.BOOLEAN, "true"))
                    .put(
                        "history",
                        new JsonnetArgs(
                            DataType.STRING,
                            mapper.get("chatHistory"))) // Getting ChatHistory from Mapper
                    .put("keepContext", new JsonnetArgs(DataType.BOOLEAN, "true"))
                    .put(
                        "context",
                        new JsonnetArgs(
                            DataType.STRING, mapper.get("queries"))) // Getting Queries from Mapper
                    .loadOrReload(); // Step 5: Pass the Args & Reload Jsonnet

                StringBuilder openAiResponseBuilder = new StringBuilder();
                return chatEndpoint
                    .getChatCompletion(
                        loader.get("prompt")) // Pass the concatenated prompt to JsonnetLoader
                    /**
                     * Here is the interesting part; So, with ChatCompletion Stream we will have
                     * streaming Therefore, we create a StringBuilder to append the response as we
                     * need to save in redis
                     */
                    .doOnNext(
                        chatCompletionResponse -> {
                          // If ChatCompletion (stream = true);
                          if (chatCompletionResponse.getObject().equals("chat.completion.chunk")) {
                            // Append the ChatCompletion Response until, we have FinishReason;
                            // otherwise, we update the history
                            if (Objects.isNull(
                                chatCompletionResponse.getChoices().get(0).getFinishReason())) {
                              openAiResponseBuilder.append(
                                  chatCompletionResponse
                                      .getChoices()
                                      .get(0)
                                      .getMessage()
                                      .getContent());
                            } else {
                              EdgeChain.fromObservable(
                                      postgreSQLContextEndpoint.put(
                                          historyContext.getId(),
                                          query
                                              + openAiResponseBuilder
                                              + mapper.get(
                                                  "chatHistory")) // Getting ChatHistory from Mapper
                                      )
                                  .get();

                              // Query(What is the collect stage for data maturity) + OpenAiResponse
                              // + Prev. ChatHistory
                            }
                          }
                          // If ChatCompletion (stream = false);
                          else if (chatCompletionResponse.getObject().equals("chat.completion")) {

                            EdgeChain.fromObservable(
                                    postgreSQLContextEndpoint.put(
                                        historyContext.getId(),
                                        query
                                            + chatCompletionResponse
                                                .getChoices()
                                                .get(0)
                                                .getMessage()
                                                .getContent()
                                            + mapper.get(
                                                "chatHistory")) // Getting ChatHistory from Mapper
                                    )
                                .get();
                            // Query(What is the collect stage for data maturity) +OpenAiResponse +
                            // Prev. ChatHistory
                          }
                        });
              })
          .getArkResponse();
    }

    @DeleteMapping("/postgres/deleteAll")
    public ArkResponse deletePostgres(ArkRequest arkRequest) {
      String table = arkRequest.getQueryParam("table");
      String namespace = arkRequest.getQueryParam("namespace");

      PostgresEndpoint postgresEndpoint =
          new PostgresEndpoint(table, namespace, new FixedDelay(5, 10, TimeUnit.SECONDS));

      return new EdgeChain<>(postgresEndpoint.deleteAll()).getArkResponse();
    }
  }
}
