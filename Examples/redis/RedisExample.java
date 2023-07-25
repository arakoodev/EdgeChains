package com.edgechain;

import static com.edgechain.lib.constants.EndpointConstants.OPENAI_CHAT_COMPLETION_API;
import static com.edgechain.lib.constants.EndpointConstants.OPENAI_EMBEDDINGS_API;

import com.edgechain.lib.chains.RedisRetrieval;
import com.edgechain.lib.chains.Retrieval;
import com.edgechain.lib.chunk.enums.LangType;
import com.edgechain.lib.configuration.domain.CorsEnableOrigins;
import com.edgechain.lib.configuration.domain.ExcludeMappingFilter;
import com.edgechain.lib.configuration.domain.RedisEnv;
import com.edgechain.lib.context.domain.HistoryContext;
import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.impl.OpenAiEndpoint;
import com.edgechain.lib.endpoint.impl.RedisEndpoint;
import com.edgechain.lib.endpoint.impl.RedisHistoryContextEndpoint;
import com.edgechain.lib.endpoint.impl.WikiEndpoint;
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
public class RedisExample {

  private final String OPENAI_AUTH_KEY = "";

  public static void main(String[] args) {
    System.setProperty("server.port", "8080");
    SpringApplication.run(RedisExample.class, args);
  }

  // Adding Cors ==> You can configure multiple cors w.r.t your urls.;
  @Bean
  @Primary
  public CorsEnableOrigins corsEnableOrigins() {
    CorsEnableOrigins origins = new CorsEnableOrigins();
    origins.setOrigins(Arrays.asList("http://localhost:4200", "http://localhost:4201"));
    return origins;
  }

  /* Optional (not required if you are not using Redis), always create bean with @Primary annotation */
  @Bean
  @Primary
  public RedisEnv redisEnv() {
    RedisEnv redisEnv = new RedisEnv();
    redisEnv.setUrl("");
    redisEnv.setPort(12285);
    redisEnv.setUsername("default");
    redisEnv.setPassword("");
    redisEnv.setTtl(3600); // Configuring ttl for HistoryContext;
    return redisEnv;
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
  public class RedisController {

    @Autowired private PdfReader pdfReader;

    /*** Creating HistoryContext (Using Redis)  ****/
    @PostMapping("/redis/historycontext")
    public ArkResponse createRedisHistoryContext(ArkRequest arkRequest) {

      RedisHistoryContextEndpoint endpoint =
          new RedisHistoryContextEndpoint(new FixedDelay(2, 3, TimeUnit.SECONDS));

      return new ArkResponse(
          endpoint.create(
              UUID.randomUUID()
                  .toString())); // Here randomId is generated, you can provide your own ids....
    }

    @PutMapping("/redis/historycontext")
    public ArkResponse putRedisHistoryContext(ArkRequest arkRequest) throws IOException {
      JSONObject json = arkRequest.getBody();

      RedisHistoryContextEndpoint endpoint =
          new RedisHistoryContextEndpoint(new FixedDelay(2, 3, TimeUnit.SECONDS));

      return new ArkResponse(endpoint.put(json.getString("id"), json.getString("response")));
    }

    @GetMapping("/redis/historycontext")
    public ArkResponse getRedisHistoryContext(ArkRequest arkRequest) {
      String id = arkRequest.getQueryParam("id");

      RedisHistoryContextEndpoint endpoint =
          new RedisHistoryContextEndpoint(new FixedDelay(2, 3, TimeUnit.SECONDS));

      return new ArkResponse(endpoint.get(id));
    }

    @DeleteMapping("/redis/historycontext")
    public void deleteRedisHistoryContext(ArkRequest arkRequest) {
      String id = arkRequest.getQueryParam("id");

      RedisHistoryContextEndpoint endpoint =
          new RedisHistoryContextEndpoint(new FixedDelay(2, 3, TimeUnit.SECONDS));

      endpoint.delete(id);
    }

    /********************** REDIS WITH OPENAI ****************************/

    // Namespace is optional (if not provided, it will be using namespace will be "knowledge")
    @PostMapping("/redis/openai/upsert") // /v1/examples/openai/upsert?namespace=machine-learning
    public void upsertRedis(ArkRequest arkRequest) throws IOException {

      String namespace = arkRequest.getQueryParam("namespace");
      String indexName = arkRequest.getQueryParam("indexName");
      InputStream file = arkRequest.getMultiPart("file").getInputStream();

      /**
       * Both IndexName & namespace are integral for upsert & performing similarity search; If you
       * are creating different namespace; recommended to use different index_name *
       */
      RedisEndpoint redisEndpoint =
          new RedisEndpoint(indexName, namespace, new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

      OpenAiEndpoint embeddingEndpoint =
          new OpenAiEndpoint(
              OPENAI_EMBEDDINGS_API,
              OPENAI_AUTH_KEY,
              "text-embedding-ada-002",
              new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

      /**
       * Currently, the entire file is loaded into memory (later; it will be loaded in buffers); We
       * have two implementation for Read By Sentence: a) readBySentence(LangType, Your File)
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
          new RedisRetrieval(redisEndpoint, embeddingEndpoint, 1536, RedisDistanceMetric.COSINE);
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

      System.out.println(query);
      System.out.println(topK);
      System.out.println(indexName);
      System.out.println(namespace);

      RedisEndpoint redisEndpoint = new RedisEndpoint(indexName, namespace);

      OpenAiEndpoint embeddingEndpoint =
          new OpenAiEndpoint(
              OPENAI_EMBEDDINGS_API,
              OPENAI_AUTH_KEY,
              "text-embedding-ada-002",
              new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

      return new EdgeChain<>(
              embeddingEndpoint.getEmbeddings(
                  query)) // Step 1: Generate embedding using OpenAI for provided input
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

      System.out.println(query);

      RedisEndpoint redisEndpoint = new RedisEndpoint(indexName, namespace);

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
              new ExponentialDelay(3, 5, 2, TimeUnit.SECONDS));

      JsonnetLoader loader =
          new FileJsonnetLoader("R:\\Github\\redis-query.jsonnet")
              .put("keepMaxTokens", new JsonnetArgs(DataType.BOOLEAN, "true"))
              .put("maxTokens", new JsonnetArgs(DataType.INTEGER, "4096"));

      return new EdgeChain<>(
              embeddingEndpoint.getEmbeddings(
                  query)) // Step 1: Generate embedding using OpenAI for provided input
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
                  loader
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
                      chatEndpoint
                          .getChatCompletion(loader.get("prompt"))
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

      System.out.println(contextId);
      System.out.println(query);
      System.out.println(namespace);
      System.out.println(stream);

      RedisHistoryContextEndpoint contextEndpoint =
          new RedisHistoryContextEndpoint(new FixedDelay(3, 3, TimeUnit.SECONDS));
      HistoryContext historyContext =
          EdgeChain.fromObservable(contextEndpoint.get(contextId)).get();

      // Step 1: Create JsonnetLoader || Pass Args || Load The File;
      JsonnetLoader loader = new FileJsonnetLoader("R:\\Github\\pinecone-chat.jsonnet");
      loader
          .put("keepMaxTokens", new JsonnetArgs(DataType.BOOLEAN, "true"))
          .put("maxTokens", new JsonnetArgs(DataType.INTEGER, "4096"))
          .put("query", new JsonnetArgs(DataType.STRING, query))
          .put("keepHistory", new JsonnetArgs(DataType.BOOLEAN, "false"))
          .loadOrReload();

      // Step 2: Create RedisEndpoint for Query, OpenAIEndpoint for Using Embedding & Chat Service
      RedisEndpoint redisEndpoint =
          new RedisEndpoint(indexName, namespace, new FixedDelay(3, 3, TimeUnit.SECONDS));
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

    /** Delete Redis By Pattern Name * */
    @DeleteMapping("/redis/delete") // /v1/examples/redis/delete?pattern=machine-learning* (Will
    // delete all the
    // keys start with machine-learning namespace
    public void deleteRedis(ArkRequest arkRequest) {
      String patternName = arkRequest.getQueryParam("pattern");
      RedisEndpoint redisEndpoint = new RedisEndpoint();
      redisEndpoint.delete(patternName);
    }
  }
}
