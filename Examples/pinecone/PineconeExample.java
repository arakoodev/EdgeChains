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


  private JsonnetLoader queryLoader = new FileJsonnetLoader("R:\\Github\\pinecone-query.jsonnet");
  private JsonnetLoader chatLoader = new FileJsonnetLoader("R:\\Github\\pinecone-chat.jsonnet");


  public static void main(String[] args) {
    System.setProperty("server.port", "8080");
    Properties properties = new Properties();

    properties.setProperty("spring.jpa.show-sql", "true");
    properties.setProperty("spring.jpa.properties.hibernate.format_sql", "true");

    //Adding Cors ==> You can configure multiple cors w.r.t your urls.;
    properties.setProperty("cors.origins", "http://localhost:4200");

    // Redis Configuration
    properties.setProperty("redis.url", "");
    properties.setProperty("redis.port","12285");
    properties.setProperty("redis.username", "");
    properties.setProperty("redis.password", "");
    properties.setProperty("redis.ttl", "3600");

    // If you want to use PostgreSQL only; then just provide dbHost, dbUsername & dbPassword.
    // If you haven't specified PostgreSQL, then logs won't be stored.
    properties.setProperty("postgres.db.host", "");
    properties.setProperty("postgres.db.username", "postgres");
    properties.setProperty("postgres.db.password", "");

    new SpringApplicationBuilder(PineconeExample.class).properties(properties).run(args);

    // Variables Initialization ==> Endpoints must be intialized in main method...
    ada002Embedding = new OpenAiEndpoint(
            OPENAI_EMBEDDINGS_API,
            OPENAI_AUTH_KEY,
            "text-embedding-ada-002",
            new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

    gpt3Endpoint = new OpenAiEndpoint(
            OPENAI_CHAT_COMPLETION_API,
            OPENAI_AUTH_KEY,
            "gpt-3.5-turbo",
            "user",
            0.7,
            new ExponentialDelay(3, 5, 2, TimeUnit.SECONDS));

    upsertPineconeEndpoint = new PineconeEndpoint(
            PINECONE_UPSERT_API,
            PINECONE_AUTH_KEY,
            new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

    queryPineconeEndpoint =
            new PineconeEndpoint(
                    PINECONE_QUERY_API,
                    PINECONE_AUTH_KEY,
                    new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

    deletePineconeEndpoint =
            new PineconeEndpoint(
                    PINECONE_DELETE,
                    PINECONE_AUTH_KEY,
                    new FixedDelay(4, 5, TimeUnit.SECONDS));

    contextEndpoint = new RedisHistoryContextEndpoint(new ExponentialDelay(2, 2, 2, TimeUnit.SECONDS));
  }

  /** By Default, every API is unauthenticated & exposed without any sort of authentication;
   * To authenticate, your custom APIs in Controller you would need @PreAuthorize(hasAuthority("")); this will authenticate by JWT having two fields: a) email, b) role:"authenticated,user_create"
   * To authenticate, internal APIs related to historyContext & Logging, Delete Redis/Postgres
   *                           we need to create bean of AuthFilter; you can uncomment the code.
   * Note, you need to define "jwt.secret" property as well to decode accessToken.
   */
//  @Bean
//  @Primary
//  public AuthFilter authFilter() {
//    AuthFilter filter = new AuthFilter();
//    // ======== new MethodAuthentication(List.of(APIs), authorities) =============
//    filter.setRequestPost(new MethodAuthentication(List.of("/v1/postgresql/historycontext"), "authenticated")); // define multiple roles by comma
//    filter.setRequestGet(new MethodAuthentication(List.of(""), ""));
//    filter.setRequestDelete(new MethodAuthentication(List.of(""), ""));
//    filter.setRequestPatch(new MethodAuthentication(List.of(""), ""));
//    filter.setRequestPut(new MethodAuthentication(List.of(""), ""));
//    return filter;
//  }



  @RestController
  @RequestMapping("/v1/examples")
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
    @PostMapping("/pinecone/openai/upsert") // /v1/examples/openai/upsert?namespace=machine-learning
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
      Retrieval retrieval = new PineconeRetrieval(upsertPineconeEndpoint, ada002Embedding, arkRequest);
      IntStream.range(0, arr.length).parallel().forEach(i -> retrieval.upsert(arr[i]));
    }

    @PostMapping(
        value = "/pinecone/openai/query",
        produces = {MediaType.APPLICATION_JSON_VALUE})
    public ArkResponse queryPinecone(ArkRequest arkRequest) {

      String namespace = arkRequest.getQueryParam("namespace");
      String query = arkRequest.getBody().getString("query");
      int topK = arkRequest.getIntQueryParam("topK");

      // Configure Pinecone
      queryPineconeEndpoint.setNamespace(namespace);

      queryLoader
              .put("keepMaxTokens", new JsonnetArgs(DataType.BOOLEAN, "true"))
              .put("maxTokens", new JsonnetArgs(DataType.INTEGER, "4096"));

      return new EdgeChain<>(
              ada002Embedding.embeddings(query,arkRequest)) // Step 1: Generate embedding using OpenAI for provided input
          .transform(
              embeddings ->
                  new EdgeChain<>(queryPineconeEndpoint.query(embeddings, topK))
                      .get()) // Step 2: Block The Observable & Get the result from Pinecone(id,//
          // scores)
          .transform(
              embeddingsQuery -> {
                List<ChatCompletionResponse> resp = new ArrayList<>();

                // Iterate over each Query result; returned from Pinecone
                Iterator<WordEmbeddings> iterator = embeddingsQuery.iterator();
                while (iterator.hasNext()) {

                  String pinecone = iterator.next().getId();

                  queryLoader
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
                      EdgeChain.fromObservable(gpt3Endpoint.chatCompletion(queryLoader.get("prompt"), "PineconeQueryChain", arkRequest))
                          .get()); // You can use both new EdgeChain<>() or
                  // EdgeChain.fromObservable()
                  // Wrap the Observable & get the data in a blocking way... Pass the concatenated
                  // prompt to ChatCompletion..
                }
                return resp;
              })
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
        value = "/pinecone/openai/chat",
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

      HistoryContext historyContext =
          EdgeChain.fromObservable(contextEndpoint.get(contextId)).get();

      // Step 1: Create JsonnetLoader || Pass Args || Load The File;
      chatLoader
          .put("keepMaxTokens", new JsonnetArgs(DataType.BOOLEAN, "true"))
          .put("maxTokens", new JsonnetArgs(DataType.INTEGER, "4096"))
          .put("query", new JsonnetArgs(DataType.STRING, query))
          .put("keepHistory", new JsonnetArgs(DataType.BOOLEAN, "false"))
          .loadOrReload();

      // Extract topK value from JsonnetLoader;
      int topK = chatLoader.getInt("topK");

      return new EdgeChain<>(
              ada002Embedding.embeddings(query,arkRequest)) // Step 1: Generate embedding using OpenAI for provided input
          .transform(
              embeddings ->
                  EdgeChain.fromObservable(queryPineconeEndpoint.query(embeddings, topK))
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
                // Creating HashMap<String,String> to store both my chatHistory & pineconeOutput
                // (queries) because I would be needing them in the chains
                HashMap<String, String> mapper = new HashMap<>();
                mapper.put("queries", queries);
                mapper.put("chatHistory", historyContext.getResponse());

                return mapper;
              }) // Step 4: Get the ChatHistory, and then we pass ChatHistory & PineconeOutput to
          // our JsonnetLoader
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
                return gpt3Endpoint.chatCompletion(chatLoader.get("prompt"), "PineconeChatChain", arkRequest ) // Pass the concatenated prompt to JsonnetLoader
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

    // Namespace is optional (if not provided, it will be using Empty String "")
    @DeleteMapping("/pinecone/deleteAll")
    public ArkResponse deletePinecone(ArkRequest arkRequest) {
      String namespace = arkRequest.getQueryParam("namespace");
      deletePineconeEndpoint.setNamespace(namespace);
      return new EdgeChain<>(deletePineconeEndpoint.deleteAll()).getArkResponse();
    }
  }
}
