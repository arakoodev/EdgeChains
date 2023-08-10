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

import io.reactivex.rxjava3.core.Observable;
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

  private JsonnetLoader queryLoader = new FileJsonnetLoader("./redis/redis-query.jsonnet");
  private JsonnetLoader chatLoader = new FileJsonnetLoader("./redis/redis-chat.jsonnet");

  public static void main(String[] args) {
    System.setProperty("server.port", "8080");

    Properties properties = new Properties();

    properties.setProperty("spring.jpa.show-sql", "true");
    properties.setProperty("spring.jpa.properties.hibernate.format_sql", "true");

    // Adding Cors ==> You can configure multiple cors w.r.t your urls.;
    properties.setProperty("cors.origins", "http://localhost:4200");

    // If you want to use PostgreSQL only; then just provide dbHost, dbUsername & dbPassword.
    // If you haven't specified PostgreSQL, then logs won't be stored.
    properties.setProperty(
        "postgres.db.host", "");
    properties.setProperty("postgres.db.username", "postgres");
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

    redisEndpoint =
        new RedisEndpoint("vector_index", new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));
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
  public class RedisController {

    @Autowired private PdfReader pdfReader;

    /********************** REDIS WITH OPENAI ****************************/

    // Namespace is optional (if not provided, it will be using namespace will be "knowledge")
    @PostMapping("/redis/upsert") // /v1/examples/openai/upsert?namespace=machine-learning
    public void upsert(ArkRequest arkRequest) throws IOException {

      String namespace = arkRequest.getQueryParam("namespace");
      InputStream file = arkRequest.getMultiPart("file").getInputStream();

      /**
       * Both IndexName & namespace are integral for upsert & performing similarity search; If you
       * are creating different namespace; recommended to use different index_name because filtering
       * is done by index_name *
       */
      // Configure RedisEndpoint
      redisEndpoint.setNamespace(namespace);

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
        value = "/redis/similarity-search",
        produces = {MediaType.APPLICATION_JSON_VALUE})
    public ArkResponse similaritySearch(ArkRequest arkRequest) {

      String namespace = arkRequest.getQueryParam("namespace");
      String query = arkRequest.getBody().getString("query");
      int topK = arkRequest.getIntQueryParam("topK");

      redisEndpoint.setNamespace(namespace);

      // Chain 1 ==> Generate Embeddings Using Ada002
      EdgeChain<WordEmbeddings> ada002Chain = new EdgeChain<>(ada002Embedding.embeddings(query, arkRequest));

      // Chain 2 ==> Pass those embeddings to Redis & Return Score/values (Similarity search)
      EdgeChain<List<WordEmbeddings>> redisQueries = new EdgeChain<>(redisEndpoint.query(ada002Chain.get(), topK));

      return redisQueries.getArkResponse();
    }

    @PostMapping(
        value = "/redis/query",
        produces = {MediaType.APPLICATION_JSON_VALUE})
    public ArkResponse queryRedis(ArkRequest arkRequest) {

      String namespace = arkRequest.getQueryParam("namespace");
      String query = arkRequest.getBody().getString("query");
      int topK = arkRequest.getIntQueryParam("topK");

      redisEndpoint.setNamespace(namespace);

      // Chain 1==> Get Embeddings  From Input & Then Query To Redis
      EdgeChain<WordEmbeddings> embeddingsChain =
          new EdgeChain<>(ada002Embedding.embeddings(query, arkRequest));

      //  Chain 2 ==> Query Embeddings from Redis
      EdgeChain<List<WordEmbeddings>> queryChain =
          new EdgeChain<>(redisEndpoint.query(embeddingsChain.get(), topK));

      //  Chain 3 ===> Our queryFn passes takes list and passes each response with base prompt to
      // OpenAI
      EdgeChain<List<ChatCompletionResponse>> gpt3Chain =
          queryChain.transform(wordEmbeddings -> queryFn(wordEmbeddings, arkRequest));

      return gpt3Chain.getArkResponse();
    }

    @PostMapping(
        value = "/redis/chat",
        produces = {MediaType.APPLICATION_JSON_VALUE, MediaType.TEXT_EVENT_STREAM_VALUE})
    public ArkResponse chatWithRedis(ArkRequest arkRequest) {

      String contextId = arkRequest.getQueryParam("id");
      String query = arkRequest.getBody().getString("query");
      String namespace = arkRequest.getQueryParam("namespace");
      boolean stream = arkRequest.getBooleanHeader("stream");

      // configure GPT3Endpoint
      gpt3Endpoint.setStream(stream);

      redisEndpoint.setNamespace(namespace);

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

      // Chain 1 ==> Get Embeddings From Input
      EdgeChain<WordEmbeddings> embeddingsChain =
          new EdgeChain<>(ada002Embedding.embeddings(query, arkRequest));

      // Chain 2 ==> Query Embeddings from Redis & Then concatenate it (preparing for prompt)
      // let's say topK=5; then we concatenate List into a string using String.join method
      EdgeChain<List<WordEmbeddings>> redisChain =
          new EdgeChain<>(redisEndpoint.query(embeddingsChain.get(), topK));

      // Chain 3 ===> Transform String of Queries into List<Queries>
      EdgeChain<String> queryChain =
          new EdgeChain<>(redisChain)
              .transform(
                  redisResponse -> {
                    List<String> queryList = new ArrayList<>();
                    redisResponse.get().forEach(q -> queryList.add(q.getId()));
                    return String.join("\n", queryList);
                  });

      // Chain 4 ===> Create fn() to prepare your chat prompt
      EdgeChain<String> promptChain =
          queryChain.transform(queries -> chatFn(historyContext.getResponse(), queries));

      // Chain 5 ==> Pass the Prompt To Gpt3
      EdgeChain<ChatCompletionResponse> gpt3Chain =
          new EdgeChain<>(
              gpt3Endpoint.chatCompletion(promptChain.get(), "RedisChatChain", arkRequest));

      //  (FOR NON STREAMING)
      // If it's not stream ==>
      // Query(What is the collect stage for data maturity) + OpenAiResponse + Prev. ChatHistory
      if (!stream) {

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

        /* As the response is in stream, so we will use StringBuilder to append the response
        and once GPT chain indicates that it is finished, we will save the following into Redis
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
        List<WordEmbeddings> wordEmbeddings, ArkRequest arkRequest) {

      List<ChatCompletionResponse> resp = new ArrayList<>();

      // Iterate over each Query result; returned from Redis
      for (WordEmbeddings wordEmbedding : wordEmbeddings) {

        String query = wordEmbedding.getId();

        queryLoader
            .put("keepMaxTokens", new JsonnetArgs(DataType.BOOLEAN, "true"))
            .put("maxTokens", new JsonnetArgs(DataType.INTEGER, "4096"))
            .put("keepContext", new JsonnetArgs(DataType.BOOLEAN, "true"))
            .put(
                "context",
                new JsonnetArgs(
                    DataType.STRING,
                    query)) // Step 3: Concatenate the Prompt: ${Base Prompt} - ${Redis
            // Output}
            .loadOrReload();
        // Step 4: Now, pass the prompt to OpenAI ChatCompletion & Add it to the list which will be
        // returned
        resp.add(
            new EdgeChain<>(
                    gpt3Endpoint.chatCompletion(
                        queryLoader.get("prompt"), "RedisQueryChain", arkRequest))
                .get());
      }

      return resp;
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
}
