package com.edgechain;

import static com.edgechain.lib.constants.EndpointConstants.OPENAI_CHAT_COMPLETION_API;
import static com.edgechain.lib.constants.EndpointConstants.OPENAI_EMBEDDINGS_API;

import com.edgechain.lib.chains.RedisRetrieval;
import com.edgechain.lib.chains.Retrieval;
import com.edgechain.lib.chunk.enums.LangType;
import com.edgechain.lib.context.domain.HistoryContext;
import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.impl.*;
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
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;

import java.io.IOException;
import java.io.InputStream;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.IntStream;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

@SpringBootApplication
public class RedisExample {

  private static final String OPENAI_AUTH_KEY = "";

  private static OpenAiEndpoint ada002Embedding;
  private static OpenAiEndpoint gpt3Endpoint;
  private static RedisEndpoint redisEndpoint;
  private static RedisHistoryContextEndpoint contextEndpoint;

  private JsonnetLoader queryLoader = new FileJsonnetLoader("R:\\Github\\redis-query.jsonnet");
  private JsonnetLoader chatLoader = new FileJsonnetLoader("R:\\Github\\redis-chat.jsonnet");

  public static void main(String[] args) {
    System.setProperty("server.port", "8080");

    Properties properties = new Properties();

    properties.setProperty("spring.jpa.show-sql", "true");
    properties.setProperty("spring.jpa.properties.hibernate.format_sql", "true");

    // Adding Cors ==> You can configure multiple cors w.r.t your urls.;
    properties.setProperty("cors.origins", "http://localhost:4200");

    // If you want to use PostgreSQL only; then just provide dbHost, dbUsername & dbPassword.
    // If you haven't specified PostgreSQL, then logs won't be stored.
    properties.setProperty("postgres.db.host", "");
    properties.setProperty("postgres.db.username", "");
    properties.setProperty("postgres.db.password", "");

    // Redis Configuration
    properties.setProperty("redis.url", "");
    properties.setProperty("redis.port", "12285");
    properties.setProperty("redis.username", "default");
    properties.setProperty("redis.password", "");
    properties.setProperty("redis.ttl", "3600");

    new SpringApplicationBuilder(RedisExample.class).properties(properties).run(args);

    // Variables Initialization ==> Endpoints must be intialized in main method...
    ada002Embedding =
        new OpenAiEndpoint(
            OPENAI_EMBEDDINGS_API,
            OPENAI_AUTH_KEY,
            "text-embedding-ada-002",
            new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

    gpt3Endpoint =
        new OpenAiEndpoint(
            OPENAI_CHAT_COMPLETION_API,
            OPENAI_AUTH_KEY,
            "gpt-3.5-turbo",
            "user",
            0.7,
            new ExponentialDelay(3, 5, 2, TimeUnit.SECONDS));

    redisEndpoint = new RedisEndpoint(new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));
    contextEndpoint =
        new RedisHistoryContextEndpoint(new ExponentialDelay(2, 2, 2, TimeUnit.SECONDS));
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
  @RequestMapping("/v1/examples")
  public class RedisController {

    @Autowired private PdfReader pdfReader;

    /********************** REDIS WITH OPENAI ****************************/

    // Namespace is optional (if not provided, it will be using namespace will be "knowledge")
    @PostMapping("/redis/openai/upsert") // /v1/examples/openai/upsert?namespace=machine-learning
    public void upsertRedis(ArkRequest arkRequest) throws IOException {

      String namespace = arkRequest.getQueryParam("namespace");
      String indexName = arkRequest.getQueryParam("indexName");
      InputStream file = arkRequest.getMultiPart("file").getInputStream();

      /**
       * Both IndexName & namespace are integral for upsert & performing similarity search; If you
       * are creating different namespace; recommended to use different index_name because filtering
       * is done by index_name *
       */

      // Configure RedisEndpoint
      redisEndpoint.setNamespace(namespace);
      redisEndpoint.setIndexName(indexName);

      /**
       * We have two implementation for Read By Sentence: a) readBySentence(LangType, Your File)
       * EdgeChains sdk has predefined support to chunk by sentences w.r.t to 5 languages (english,
       * france, german, italy, dutch....)
       *
       * <p>b) readBySentence(Custom OpenNLP Trained Model, Your File)
       */
      String[] arr = pdfReader.readBySentence(LangType.EN, file);

      /**
       * Retrieval Class is basically used to generate embeddings & upsert it to VectorDB; If OpenAI
       * Embedding Endpoint is not provided; then Doc2Vec constructor is used If the model is not
       * provided, then it will emit an error
       */
      Retrieval retrieval =
          new RedisRetrieval(
              redisEndpoint, ada002Embedding, 1536, RedisDistanceMetric.COSINE, arkRequest);
      IntStream.range(0, arr.length).parallel().forEach(i -> retrieval.upsert(arr[i]));
    }

    /**
     * Objective: I want to pass input, generate embeddings using OpenAI and get results from Redis
     *
     * @param arkRequest
     * @return
     */
    @PostMapping(
        value = "/redis/openai/similarity-search",
        produces = {MediaType.APPLICATION_JSON_VALUE})
    public ArkResponse redisSimilaritySearch(ArkRequest arkRequest) {

      String namespace = arkRequest.getQueryParam("namespace");
      String query = arkRequest.getBody().getString("query");
      String indexName = arkRequest.getQueryParam("indexName");
      int topK = arkRequest.getIntQueryParam("topK");

      // Configure RedisEndpoint
      redisEndpoint.setNamespace(namespace);
      redisEndpoint.setIndexName(indexName);

      return new EdgeChain<>(
              ada002Embedding.embeddings(
                  query, arkRequest)) // Step 1: Generate embedding using OpenAI for provided input
          .transform(
              embeddings ->
                  EdgeChain.fromObservable(redisEndpoint.query(embeddings, topK))
                      .get()) // Step 2: Get the result from Redis
          .getArkResponse();
    }

    @PostMapping(
        value = "/redis/openai/query",
        produces = {MediaType.APPLICATION_JSON_VALUE})
    public ArkResponse queryRedis(ArkRequest arkRequest) {

      String namespace = arkRequest.getQueryParam("namespace");
      String indexName = arkRequest.getQueryParam("indexName");
      String query = arkRequest.getBody().getString("query");
      int topK = arkRequest.getIntQueryParam("topK");

      // Configure Redis Endpoint
      redisEndpoint.setNamespace(namespace);
      redisEndpoint.setIndexName(indexName);

      queryLoader
          .put("keepMaxTokens", new JsonnetArgs(DataType.BOOLEAN, "true"))
          .put("maxTokens", new JsonnetArgs(DataType.INTEGER, "4096"));

      return new EdgeChain<>(
              ada002Embedding.embeddings(
                  query, arkRequest)) // Step 1: Generate embedding using OpenAI for provided input
          .transform(
              embeddings ->
                  EdgeChain.fromObservable(redisEndpoint.query(embeddings, topK))
                      .get()) // Step 2: Blocking Get the result from Redis(id, scores)
          .transform(
              embeddingsQuery -> {
                List<ChatCompletionResponse> resp = new ArrayList<>();

                // Iterate over each Query result; returned from Pinecone
                Iterator<WordEmbeddings> iterator = embeddingsQuery.iterator();
                while (iterator.hasNext()) {

                  String redis = iterator.next().getId();
                  queryLoader
                      .put("keepContext", new JsonnetArgs(DataType.BOOLEAN, "true"))
                      .put(
                          "context",
                          new JsonnetArgs(
                              DataType.STRING,
                              redis)) // Step 3: Concatenate the Prompt: ${Base Prompt} - ${Redis
                      // Output}
                      .loadOrReload();
                  // Step 4: Now, pass the prompt to OpenAI ChatCompletion & Add it to the list
                  // which will be returned
                  resp.add(
                      gpt3Endpoint
                          .chatCompletion(queryLoader.get("prompt"), "RedisQueryChain", arkRequest)
                          .firstOrError()
                          .blockingGet());
                }
                return resp;
              })
          .getArkResponse();
    }

    @PostMapping(
        value = "/redis/openai/chat",
        produces = {MediaType.APPLICATION_JSON_VALUE, MediaType.TEXT_EVENT_STREAM_VALUE})
    public ArkResponse chatWithRedis(ArkRequest arkRequest) {

      String contextId = arkRequest.getQueryParam("id");
      String query = arkRequest.getBody().getString("query");
      String indexName = arkRequest.getQueryParam("indexName");
      String namespace = arkRequest.getQueryParam("namespace");
      boolean stream = arkRequest.getBooleanHeader("stream");

      // configure GPT3Endpoint
      gpt3Endpoint.setStream(stream);

      HistoryContext historyContext =
          EdgeChain.fromObservable(contextEndpoint.get(contextId)).get();

      // Step 1: Create JsonnetLoader || Pass Args || Load The File;
      chatLoader
          .put("keepMaxTokens", new JsonnetArgs(DataType.BOOLEAN, "true"))
          .put("maxTokens", new JsonnetArgs(DataType.INTEGER, "4096"))
          .put("query", new JsonnetArgs(DataType.STRING, query))
          .put("keepHistory", new JsonnetArgs(DataType.BOOLEAN, "false"))
          .loadOrReload();

      // Configure Redis
      redisEndpoint.setIndexName(indexName);
      redisEndpoint.setNamespace(namespace);

      // Extract topK value from JsonnetLoader;
      int topK = chatLoader.getInt("topK");

      return new EdgeChain<>(
              ada002Embedding.embeddings(
                  query, arkRequest)) // Step 1: Generate embedding using OpenAI for provided input
          .transform(
              embeddings ->
                  EdgeChain.fromObservable(redisEndpoint.query(embeddings, topK))
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
                // Creating HashMap<String,String> to store both my chatHistory & redisOutput
                // (queries) because I would be needing them in the chains
                HashMap<String, String> mapper = new HashMap<>();
                mapper.put("queries", queries);
                mapper.put("chatHistory", historyContext.getResponse());

                return mapper;
              }) // Step 4: Get the ChatHistory, and then we pass ChatHistory & RedisOutput to our
          // JsonnetLoader
          .transform(
              mapper -> {
                chatLoader
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
                return gpt3Endpoint
                    .chatCompletion(
                        chatLoader.get("prompt"),
                        "RedisChatChain",
                        arkRequest) // Pass the concatenated prompt to JsonnetLoader
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
                                      contextEndpoint.put(
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
                                    contextEndpoint.put(
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
  }
}
