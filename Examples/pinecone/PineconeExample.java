package com.edgechain;

import static com.edgechain.lib.constants.EndpointConstants.OPENAI_CHAT_COMPLETION_API;
import static com.edgechain.lib.constants.EndpointConstants.OPENAI_EMBEDDINGS_API;

import com.edgechain.lib.chains.PineconeRetrieval;
import com.edgechain.lib.chains.Retrieval;
import com.edgechain.lib.context.domain.HistoryContext;
import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.impl.OpenAiEndpoint;
import com.edgechain.lib.endpoint.impl.PineconeEndpoint;
import com.edgechain.lib.endpoint.impl.RedisHistoryContextEndpoint;
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
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

@SpringBootApplication
public class PineconeExample {

  private static final String OPENAI_AUTH_KEY = "";
  private static final String PINECONE_AUTH_KEY = "";
  private static final String PINECONE_QUERY_API = "";
  private static final String PINECONE_UPSERT_API = "";
  private static final String PINECONE_DELETE = "";

  private static OpenAiEndpoint ada002Embedding;
  private static OpenAiEndpoint gpt3Endpoint;

  private static PineconeEndpoint upsertPineconeEndpoint;
  private static PineconeEndpoint queryPineconeEndpoint;

  private static PineconeEndpoint deletePineconeEndpoint;

  private static RedisHistoryContextEndpoint contextEndpoint;

  private JsonnetLoader queryLoader = new FileJsonnetLoader("./pinecone//pinecone-query.jsonnet");
  private JsonnetLoader chatLoader = new FileJsonnetLoader("./pinecone/pinecone-chat.jsonnet");

  public static void main(String[] args) {
    System.setProperty("server.port", "8080");
    Properties properties = new Properties();

    properties.setProperty("spring.jpa.show-sql", "true");
    properties.setProperty("spring.jpa.properties.hibernate.format_sql", "true");

    // Adding Cors ==> You can configure multiple cors w.r.t your urls.;
    properties.setProperty("cors.origins", "http://localhost:4200");

    // Redis Configuration
    properties.setProperty("redis.url", "");
    properties.setProperty("redis.port", "12285");
    properties.setProperty("redis.username", "default");
    properties.setProperty("redis.password", "");
    properties.setProperty("redis.ttl", "3600");

    // If you want to use PostgreSQL only; then just provide dbHost, dbUsername & dbPassword.
    // If you haven't specified PostgreSQL, then logs won't be stored.
    properties.setProperty(
        "postgres.db.host", "");
    properties.setProperty("postgres.db.username", "");
    properties.setProperty("postgres.db.password", "");

    new SpringApplicationBuilder(PineconeExample.class).properties(properties).run(args);

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

    upsertPineconeEndpoint =
        new PineconeEndpoint(
            PINECONE_UPSERT_API,
            PINECONE_AUTH_KEY,
            new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

    queryPineconeEndpoint =
        new PineconeEndpoint(
            PINECONE_QUERY_API, PINECONE_AUTH_KEY, new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

    deletePineconeEndpoint =
        new PineconeEndpoint(
            PINECONE_DELETE, PINECONE_AUTH_KEY, new FixedDelay(4, 5, TimeUnit.SECONDS));

    contextEndpoint =
        new RedisHistoryContextEndpoint(new ExponentialDelay(2, 2, 2, TimeUnit.SECONDS));
  }

  /**
   * By Default, every API is unauthenticated & exposed without any sort of authentication; To
   * authenticate, your custom APIs in Controller you would need @PreAuthorize(hasAuthority(""));
   * this will authenticate by JWT having two fields: a) email, b) role:"authenticated,user_create"
   * To authenticate, internal APIs related to historyContext & Logging, Delete Redis/Postgres we
   * need to create bean of AuthFilter; you can uncomment the code. Note, you need to define
   * "jwt.secret" property as well to decode accessToken.
   */
  //  @Bean
  //  @Primary
  //  public AuthFilter authFilter() {
  //    AuthFilter filter = new AuthFilter();
  //    // ======== new MethodAuthentication(List.of(APIs), authorities) =============
  //    filter.setRequestPost(new MethodAuthentication(List.of("/v1/postgresql/historycontext"),
  // "authenticated")); // define multiple roles by comma
  //    filter.setRequestGet(new MethodAuthentication(List.of(""), ""));
  //    filter.setRequestDelete(new MethodAuthentication(List.of(""), ""));
  //    filter.setRequestPatch(new MethodAuthentication(List.of(""), ""));
  //    filter.setRequestPut(new MethodAuthentication(List.of(""), ""));
  //    return filter;
  //  }

  @RestController
  @RequestMapping("/v1/examples/pinecone")
  public class PineconeController {

    @Autowired private PdfReader pdfReader;

    /********************** PINECONE WITH OPENAI ****************************/

    /**
     * Namespace: VectorDb allows you to partition the vectors in an index into namespaces. Queries
     * and other operations are then limited to one namespace, so different requests can search
     * different subsets of your index. If namespace is null or empty, in pinecone it will be
     * prefixed as "" empty string & in redis it will be prefixed as "knowledge" For example, you
     * might want to define a namespace for indexing books by finance, law, medicine etc.. Can be
     * used in multiple use-cases.... such as User uploading book, generating unique namespace &
     * then querying/chatting with it..
     *
     * @param arkRequest
     * @return
     */
    // Namespace is optional (if not provided, it will be using Empty String "")
    @PostMapping("/openai/upsert") // /v1/examples/openai/upsert?namespace=machine-learning
    public void upsertPinecone(ArkRequest arkRequest) throws IOException {

      String namespace = arkRequest.getQueryParam("namespace");
      InputStream file = arkRequest.getMultiPart("file").getInputStream();

      // Configure Pinecone
      upsertPineconeEndpoint.setNamespace(namespace);

      String[] arr = pdfReader.readByChunkSize(file, 512);

      /**
       * Retrieval Class is basically used to generate embeddings & upsert it to VectorDB; If OpenAI
       * Embedding Endpoint is not provided; then Doc2Vec constructor is used If the model is not
       * provided, then it will emit an error
       */
      Retrieval retrieval =
          new PineconeRetrieval(upsertPineconeEndpoint, ada002Embedding, arkRequest);

      IntStream.range(0, arr.length).parallel().forEach(i -> retrieval.upsert(arr[i]));
    }

    @PostMapping(
        value = "/openai/query",
        produces = {MediaType.APPLICATION_JSON_VALUE})
    public ArkResponse query(ArkRequest arkRequest) {

      String namespace = arkRequest.getQueryParam("namespace");
      String query = arkRequest.getBody().getString("query");
      int topK = arkRequest.getIntQueryParam("topK");

      // Configure Pinecone
      queryPineconeEndpoint.setNamespace(namespace);

      // Step 1: Chain ==> Get Embeddings  From Input & Then Query To Pinecone
      EdgeChain<WordEmbeddings> embeddingsChain =
          new EdgeChain<>(ada002Embedding.embeddings(query, arkRequest));

      // Step 2: Chain ==> Query Embeddings from Pinecone
      EdgeChain<List<WordEmbeddings>> queryChain =
          new EdgeChain<>(queryPineconeEndpoint.query(embeddingsChain.get(), topK));

      // Step 3: Create Function which create prompt for each query & pass it to ChatCompletion
      return queryChain
          .transform(wordEmbeddings -> queryFn(wordEmbeddings, arkRequest))
          .getArkResponse();
    }

    /**
     * For chatting, you need to create a historyContext via Redis/PostgreSQL. Implementation is
     * provided above.
     *
     * @param arkRequest
     * @return
     */
    @PostMapping(
        value = "/openai/chat",
        produces = {MediaType.APPLICATION_JSON_VALUE, MediaType.TEXT_EVENT_STREAM_VALUE})
    public ArkResponse chatWithPinecone(ArkRequest arkRequest) {

      String contextId = arkRequest.getQueryParam("id");
      String query = arkRequest.getBody().getString("query");
      String namespace = arkRequest.getQueryParam("namespace");
      boolean stream = arkRequest.getBooleanHeader("stream");

      // Configure Pinecone
      queryPineconeEndpoint.setNamespace(namespace);

      // Configure GPT3endpoint
      gpt3Endpoint.setStream(stream);

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

      // Step 1: Chain ==> Get Embeddings From Input
      EdgeChain<WordEmbeddings> embeddingsChain =
          new EdgeChain<>(ada002Embedding.embeddings(query, arkRequest));

      // Step 2: Chain ==> Query Embeddings from Pinecone & Then concatenate it (preparing for
      // prompt)
      // let's say topK=5; then we concatenate List into a string
      EdgeChain<String> queryChain =
          new EdgeChain<>(queryPineconeEndpoint.query(embeddingsChain.get(), topK))
              .transform(
                  queries -> {
                    List<String> queryList = new ArrayList<>();
                    queries.forEach(q -> queryList.add(q.getId()));
                    return String.join("\n", queryList);
                  });

      // Step 3: Create fn() to prepare your chat prompt
      EdgeChain<String> promptChain =
          queryChain.transform(queries -> chatFn(historyContext.getResponse(), queries));

      /**
       * Step 4: Here is the interesting part; So, with ChatCompletion Stream we will have streaming
       * response Therefore, we create a StringBuilder to append the response as we need to save
       * response in Postgres Database
       */
      StringBuilder stringBuilder = new StringBuilder();

      return promptChain
          .transform(
              prompt ->
                  gpt3Endpoint
                      .chatCompletion(prompt, "PineconeChatChain", arkRequest)
                      .doOnNext(
                          chatResponse -> {
                            // If ChatCompletion (stream = true);
                            if (chatResponse.getObject().equals("chat.completion.chunk")) {
                              // Append the ChatCompletion Response until, we have FinishReason;
                              // otherwise, we update the history
                              if (Objects.isNull(
                                  chatResponse.getChoices().get(0).getFinishReason())) {
                                stringBuilder.append(
                                    chatResponse.getChoices().get(0).getMessage().getContent());
                              }

                              // When response is finished, then update it to Database
                              // Query(What is the collect stage for data maturity) + OpenAiResponse
                              // + Prev. ChatHistory
                              else {
                                contextEndpoint.put(
                                    historyContext.getId(),
                                    query + stringBuilder + historyContext.getResponse());
                              }

                            }
                            // if ChatCompletion (stream = false) -->
                            // Query(What is the collect stage for data maturity) + OpenAiResponse +
                            // Prev. ChatHistory
                            else
                              contextEndpoint.put(
                                  historyContext.getId(),
                                  query
                                      + chatResponse.getChoices().get(0).getMessage().getContent()
                                      + historyContext.getResponse());
                          }))
          .getArkResponse();
    }

    // Namespace is optional (if not provided, it will be using Empty String "")
    @DeleteMapping("/deleteAll")
    public ArkResponse deletePinecone(ArkRequest arkRequest) {
      String namespace = arkRequest.getQueryParam("namespace");
      deletePineconeEndpoint.setNamespace(namespace);
      return new EdgeChain<>(deletePineconeEndpoint.deleteAll()).getArkResponse();
    }

    public List<ChatCompletionResponse> queryFn(
        List<WordEmbeddings> wordEmbeddings, ArkRequest arkRequest) {

      List<ChatCompletionResponse> resp = new ArrayList<>();

      // Iterate over each Query result; returned from Postgres
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
                    query)) // Step 3: Concatenate the Prompt: ${Base Prompt} - ${Postgres
            // Output}
            .loadOrReload();
        // Step 4: Now, pass the prompt to OpenAI ChatCompletion & Add it to the list which will be
        // returned
        resp.add(
            new EdgeChain<>(
                    gpt3Endpoint.chatCompletion(
                        queryLoader.get("prompt"), "PineconeQueryChain", arkRequest))
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
