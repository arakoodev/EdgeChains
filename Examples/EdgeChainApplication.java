package com.edgechain;

import static com.edgechain.lib.constants.EndpointConstants.*;

import com.edgechain.lib.chains.PineconeRetrieval;
import com.edgechain.lib.chains.PostgresRetrieval;
import com.edgechain.lib.chains.RedisRetrieval;
import com.edgechain.lib.chains.Retrieval;
import com.edgechain.lib.chunk.enums.LangType;
import com.edgechain.lib.configuration.RedisEnv;
import com.edgechain.lib.context.domain.HistoryContext;
import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.embeddings.request.Doc2VecRequest;
import com.edgechain.lib.endpoint.impl.*;
import com.edgechain.lib.index.enums.PostgresDistanceMetric;
import com.edgechain.lib.index.enums.RedisDistanceMetric;
import com.edgechain.lib.jsonnet.*;
import com.edgechain.lib.jsonnet.enums.DataType;
import com.edgechain.lib.jsonnet.impl.FileJsonnetLoader;
import com.edgechain.lib.openai.response.ChatCompletionResponse;
import com.edgechain.lib.reader.impl.PdfReader;
import com.edgechain.lib.request.ArkRequest;
import com.edgechain.lib.response.ArkResponse;
import com.edgechain.lib.rxjava.retry.impl.ExponentialDelay;
import com.edgechain.lib.rxjava.retry.impl.FixedDelay;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import java.io.*;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.IntStream;
import org.deeplearning4j.models.embeddings.loader.WordVectorSerializer;
import org.deeplearning4j.models.paragraphvectors.ParagraphVectors;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

@SpringBootApplication
public class EdgeChainApplication {

  private final String OPENAI_AUTH_KEY = "";
  private final String PINECONE_AUTH_KEY = "";
  private final String PINECONE_QUERY_API = "";
  private final String PINECONE_UPSERT_API = "";
  private final String PINECONE_DELETE = "";

  private final String POSTGRES_JDBC_URL = "";
  private final String POSTGRES_USERNAME = "";
  private final String POSTGRES_PASSWORD = "";

  public static void main(String[] args) {
    System.setProperty("server.port", "8080");
    SpringApplication.run(EdgeChainApplication.class, args);
  }

  @Bean
  public RedisEnv redisEnv() {
    RedisEnv redisEnv = new RedisEnv();
    redisEnv.setUrl("");
    redisEnv.setPort(12285);
    redisEnv.setUsername("default");
    redisEnv.setPassword("");
    redisEnv.setTtl(3600); // Configuring ttl for HistoryContext;
    return redisEnv;
  }

  /************ EXAMPLE APIs **********************/

  @RestController
  @RequestMapping("/v1/examples")
  public class ExampleController {

    /**
     * Objective: Get the Content From Wikipedia & then pass the prompt: {Create 5-bullet point
     * summary of: } + {wikiContent} to OpenAiChatCompletion API.
     *
     * @return ArkResponse
     */
    @GetMapping(
        value = "/wiki-summary",
        produces = {MediaType.APPLICATION_JSON_VALUE, MediaType.TEXT_EVENT_STREAM_VALUE})
    public ArkResponse wikiSummary(ArkRequest arkRequest) {

      String query = arkRequest.getQueryParam("query");
      boolean stream = arkRequest.getBooleanHeader("stream");

      // Step 1: Create JsonnetLoader to Load JsonnetFile & Pass Args To Jsonnet
      JsonnetLoader loader =
          new FileJsonnetLoader("R:\\Github\\wiki.jsonnet")
              .put("keepMaxTokens", new JsonnetArgs(DataType.BOOLEAN, "true"))
              .put("maxTokens", new JsonnetArgs(DataType.INTEGER, "4096"));

      /* Step 2: Create WikiEndpoint to extract content from Wikipedia;
      If RetryPolicy is not passed; then there won't be any backoff mechanism.... */
      // To allow, backoff strategy you can pass either of two strategies new FixedDelay() new
      // ExponentialDelay()`
      WikiEndpoint wikiEndpoint = new WikiEndpoint();

      /* Step 3: Create OpenAiEndpoint to communicate with OpenAiServices; */
      OpenAiEndpoint openAiEndpoint =
          new OpenAiEndpoint(
              OPENAI_CHAT_COMPLETION_API,
              OPENAI_AUTH_KEY,
              "gpt-3.5-turbo",
              "user",
              0.7,
              stream,
              new ExponentialDelay(3, 5, 2, TimeUnit.SECONDS));

      return new EdgeChain<>(wikiEndpoint.getPageContent(query))
          .transform(
              wiki -> {
                loader
                    .put("keepContext", new JsonnetArgs(DataType.BOOLEAN, "true"))
                    .put(
                        "context",
                        new JsonnetArgs(
                            DataType.STRING,
                            wiki.getText())) // Step 4: Concatenate ${Base Prompt} + ${Wiki Output}
                    .loadOrReload(); // Step 5: Reloading Jsonnet File

                return loader.get("prompt");
              })
          .transform(openAiEndpoint::getChatCompletion)
          .getArkResponse();
    }

    /*** Creating HistoryContext (Using Redis) Controller ****/

    @PostMapping("/historycontext")
    public ArkResponse create(ArkRequest arkRequest) {
      RedisHistoryContextEndpoint endpoint =
          new RedisHistoryContextEndpoint(new FixedDelay(2, 3, TimeUnit.SECONDS));
      return new ArkResponse(
          endpoint.create(
              UUID.randomUUID()
                  .toString())); // Here randomId is generated, you can provide your own ids....
    }

    @PutMapping("/historycontext")
    public ArkResponse put(ArkRequest arkRequest) throws IOException {
      JSONObject json = arkRequest.getBody();
      RedisHistoryContextEndpoint endpoint =
          new RedisHistoryContextEndpoint(new FixedDelay(2, 3, TimeUnit.SECONDS));
      return new ArkResponse(endpoint.put(json.getString("id"), json.getString("response")));
    }

    @GetMapping("/historycontext")
    public ArkResponse get(ArkRequest arkRequest) {
      String id = arkRequest.getQueryParam("id");
      RedisHistoryContextEndpoint endpoint =
          new RedisHistoryContextEndpoint(new FixedDelay(2, 3, TimeUnit.SECONDS));
      return new ArkResponse(endpoint.get(id));
    }

    @DeleteMapping("/historycontext")
    public void delete(ArkRequest arkRequest) {
      String id = arkRequest.getQueryParam("id");
      RedisHistoryContextEndpoint endpoint =
          new RedisHistoryContextEndpoint(new FixedDelay(2, 3, TimeUnit.SECONDS));
      endpoint.delete(id);
    }

    @Autowired private PdfReader pdfReader;

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

      PineconeEndpoint pineconeEndpoint =
          new PineconeEndpoint(
              PINECONE_UPSERT_API,
              PINECONE_AUTH_KEY,
              namespace,
              new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

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
       * france, german, italy, dutch....) ==> Used with Redis Example (below)....
       *
       * <p>b) readBySentence(Custom OpenNLP Trained Model, Your File)
       */
      String[] arr = pdfReader.readByChunkSize(file, 512);

      /**
       * Retrieval Class is basically used to generate embeddings & upsert it to VectorDB; If OpenAI
       * Embedding Endpoint is not provided; then Doc2Vec constructor is used If the model is not
       * provided, then it will emit an error
       */
      Retrieval retrieval = new PineconeRetrieval(pineconeEndpoint, embeddingEndpoint);
      IntStream.range(0, arr.length).parallel().forEach(i -> retrieval.upsert(arr[i]));
    }

    @GetMapping(
        value = "/pinecone/openai/query",
        produces = {MediaType.APPLICATION_JSON_VALUE})
    public ArkResponse queryPinecone(ArkRequest arkRequest) {

      String namespace = arkRequest.getQueryParam("namespace");
      String query = arkRequest.getQueryParam("query");
      int topK = arkRequest.getIntQueryParam("topK");

      PineconeEndpoint pineconeEndpoint =
          new PineconeEndpoint(
              PINECONE_QUERY_API,
              PINECONE_AUTH_KEY,
              namespace,
              new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

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
          new FileJsonnetLoader("R:\\Github\\pinecone-query.jsonnet")
              .put("keepMaxTokens", new JsonnetArgs(DataType.BOOLEAN, "true"))
              .put("maxTokens", new JsonnetArgs(DataType.INTEGER, "4096"));

      return new EdgeChain<>(
              embeddingEndpoint.getEmbeddings(
                  query)) // Step 1: Generate embedding using OpenAI for provided input
          .transform(
              embeddings ->
                  new EdgeChain<>(pineconeEndpoint.query(embeddings, topK))
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

    /**
     * contextId is an optional paramater, if you didn't pass it via QueryParam; it will create a
     * new session: pinecone/openai/chat?query=What is the collect stage for data
     * maturity&namespace=machine-learning To query in a particular session, you have to provide
     * contextId i.e. /pinecone/openai/chat?contextId=1884399922113sd31&query=What is the collect
     * stage for data maturity&namespace=machine-learning Namespace is optional parameter.
     *
     * @param arkRequest
     * @return
     */
    @GetMapping(
        value = "/pinecone/openai/chat",
        produces = {MediaType.APPLICATION_JSON_VALUE, MediaType.TEXT_EVENT_STREAM_VALUE})
    public ArkResponse chatWithPinecone(ArkRequest arkRequest) {

      String contextId = arkRequest.getQueryParam("id");
      String query = arkRequest.getQueryParam("query");
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

      // Step 2: Create PineconeEndpoint for Query, OpenAIEndpoint for Using Embedding & Chat
      // Service
      PineconeEndpoint pineconeEndpoint =
          new PineconeEndpoint(
              PINECONE_QUERY_API,
              PINECONE_AUTH_KEY,
              namespace,
              new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

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
                  EdgeChain.fromObservable(pineconeEndpoint.query(embeddings, topK))
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

    // Namespace is optional (if not provided, it will be using Empty String "")
    @DeleteMapping("/pinecone/deleteAll")
    public ArkResponse deletePinecone(ArkRequest arkRequest) {
      String namespace = arkRequest.getQueryParam("namespace");
      PineconeEndpoint pineconeEndpoint =
          new PineconeEndpoint(
              PINECONE_DELETE,
              PINECONE_AUTH_KEY,
              namespace,
              new FixedDelay(4, 5, TimeUnit.SECONDS));
      return new EdgeChain<>(pineconeEndpoint.deleteAll()).getArkResponse();
    }

    /********************** REDIS WITH OPENAI ****************************/

    // Namespace is optional (if not provided, it will be using namespace will be "knowledge")
    @PostMapping("/redis/openai/upsert") // /v1/examples/openai/upsert?namespace=machine-learning
    public void upsertRedis(ArkRequest arkRequest) throws IOException {

      String namespace = arkRequest.getQueryParam("namespace");
      InputStream file = arkRequest.getMultiPart("file").getInputStream();

      /**
       * Both IndexName & namespace are integral for upsert & performing similarity search; If you
       * are creating different namespace; recommended to use different index_name *
       */
      RedisEndpoint redisEndpoint =
          new RedisEndpoint(
              "vector_index", namespace, new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

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
    @GetMapping(
        value = "/redis/openai/similarity-search",
        produces = {MediaType.APPLICATION_JSON_VALUE})
    public ArkResponse redisSimilaritySearch(ArkRequest arkRequest) {

      String namespace = arkRequest.getQueryParam("namespace");
      String query = arkRequest.getQueryParam("query");
      int topK = arkRequest.getIntQueryParam("topK");

      RedisEndpoint redisEndpoint = new RedisEndpoint("vector_index", namespace);

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

    @GetMapping(
        value = "/redis/openai/query",
        produces = {MediaType.APPLICATION_JSON_VALUE})
    public ArkResponse queryRedis(ArkRequest arkRequest) {

      String namespace = arkRequest.getQueryParam("namespace");
      String query = arkRequest.getQueryParam("query");
      int topK = arkRequest.getIntQueryParam("topK");

      RedisEndpoint redisEndpoint = new RedisEndpoint("vector_index", namespace);

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

    @GetMapping(
        value = "/redis/openai/chat",
        produces = {MediaType.APPLICATION_JSON_VALUE, MediaType.TEXT_EVENT_STREAM_VALUE})
    public ArkResponse chatWithRedis(ArkRequest arkRequest) {

      String contextId = arkRequest.getQueryParam("id");
      String query = arkRequest.getQueryParam("query");
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
          new RedisEndpoint("vector_index", namespace, new FixedDelay(3, 3, TimeUnit.SECONDS));
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
    @DeleteMapping(
        "/redis/delete") // /v1/examples/redis/delete?pattern=machine-learning* (Will delete all the
    // keys start with machine-learning namespace
    public void deleteRedis(ArkRequest arkRequest) {
      String patternName = arkRequest.getQueryParam("pattern");
      RedisEndpoint redisEndpoint = new RedisEndpoint();
      redisEndpoint.delete(patternName);
    }

    /********************** Doc2Vec Model Building *************************/
    @PostMapping("/doc2vec")
    public void buildDoc2Vec() {

      // Configuring parameters for our doc2vec model
      Doc2VecRequest doc2Vec = new Doc2VecRequest();
      doc2Vec.setFolderDirectory("R:\\Github\\train_files");
      doc2Vec.setModelName("doc_vector"); // Will be stored as doc_vector.bin
      doc2Vec.setDestination("R:\\Github\\");
      doc2Vec.setEpochs(5);
      doc2Vec.setMinWordFrequency(5);
      doc2Vec.setLearningRate(0.025);
      doc2Vec.setLayerSize(1536);
      doc2Vec.setBatchSize(15);
      doc2Vec.setWindowSize(3);

      Doc2VecEndpoint endpoint = new Doc2VecEndpoint();
      EdgeChain.fromObservable(endpoint.build(doc2Vec))
          .execute(); // Executing/Subscribing to Observable....
      // (Model has now started building; do check the console)

    }

    /** Pinecone & Doc2Vec Upsert * */
    @PostMapping("/redis/doc2vec/upsert") // /v1/examples/pinecone/doc2vec/upsert?namespace=doc2vec
    public void upsertRedisDoc2Vec(ArkRequest arkRequest) throws IOException {

      String namespace = arkRequest.getQueryParam("namespace");
      InputStream file = arkRequest.getMultiPart("file").getInputStream();

      RedisEndpoint redisEndpoint =
          new RedisEndpoint(
              "doc2vec_index", namespace, new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

      // Remember model is loaded once (this is just for example)
      ParagraphVectors paragraphVectors =
          WordVectorSerializer.readParagraphVectors(
              new FileInputStream("R:\\Github\\doc_vector.bin"));

      Doc2VecEndpoint embeddingEndpoint = new Doc2VecEndpoint(paragraphVectors);

      String[] arr = pdfReader.readByChunkSize(file, 512);

      Retrieval retrieval =
          new RedisRetrieval(redisEndpoint, embeddingEndpoint, 1536, RedisDistanceMetric.COSINE);
      IntStream.range(0, arr.length).parallel().forEach(i -> retrieval.upsert(arr[i]));
    }

    // Similarity Search
    @GetMapping(
        value = "/redis/doc2vec/similarity-search",
        produces = {MediaType.APPLICATION_JSON_VALUE})
    public ArkResponse redisDoc2VecSimilaritySearch(ArkRequest arkRequest) throws IOException {

      String namespace = arkRequest.getQueryParam("namespace");
      String query = arkRequest.getQueryParam("query");
      int topK = arkRequest.getIntQueryParam("topK");

      RedisEndpoint redisEndpoint =
          new RedisEndpoint(
              "doc2vec_index", namespace, new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

      // Remember model is loaded once (this is just for example)
      ParagraphVectors paragraphVectors =
          WordVectorSerializer.readParagraphVectors(
              new FileInputStream("R:\\Github\\doc_vector.bin"));

      Doc2VecEndpoint embeddingEndpoint = new Doc2VecEndpoint(paragraphVectors);

      return new EdgeChain<>(
              embeddingEndpoint.getEmbeddings(
                  query)) // Step 1: Generate embedding using OpenAI for provided input
          .transform(
              embeddings ->
                  EdgeChain.fromObservable(redisEndpoint.query(embeddings, topK))
                      .get()) // Step 2: Get the result from Redis
          .getArkResponse();
    }

    // ========== PGVectors ==============
    @PostMapping(
        "/postgres/openai/upsert") // /v1/examples/postgres/openai/upsert?tableName=machine-learning
    public void upsertPostgres(ArkRequest arkRequest) throws IOException {

      String table = arkRequest.getQueryParam("table");
      InputStream file = arkRequest.getMultiPart("file").getInputStream();

      PostgresEndpoint postgresEndpoint =
          new PostgresEndpoint(
              POSTGRES_JDBC_URL,
              POSTGRES_USERNAME,
              POSTGRES_PASSWORD,
              table,
              new FixedDelay(5, 10, TimeUnit.SECONDS));

      OpenAiEndpoint embeddingEndpoint =
          new OpenAiEndpoint(
              OPENAI_EMBEDDINGS_API,
              OPENAI_AUTH_KEY,
              "text-embedding-ada-002",
              new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

      String[] arr = pdfReader.readByChunkSize(file, 512);

      // Define the dimensions for embeddings.. The concept of tables is similar to namespace in
      // Redis/Pinecone
      Retrieval retrieval = new PostgresRetrieval(postgresEndpoint, 1536, embeddingEndpoint);
      IntStream.range(0, arr.length).parallel().forEach(i -> retrieval.upsert(arr[i]));
    }

    @GetMapping(
        value = "/postgres/openai/query",
        produces = {MediaType.APPLICATION_JSON_VALUE})
    public ArkResponse queryPostgres(ArkRequest arkRequest) {

      String table = arkRequest.getQueryParam("table");
      String query = arkRequest.getQueryParam("query");
      int topK = arkRequest.getIntQueryParam("topK");

      PostgresEndpoint postgresEndpoint =
          new PostgresEndpoint(
              POSTGRES_JDBC_URL,
              POSTGRES_USERNAME,
              POSTGRES_PASSWORD,
              table,
              new FixedDelay(5, 10, TimeUnit.SECONDS));

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

    @GetMapping(
        value = "/postgres/openai/chat",
        produces = {MediaType.APPLICATION_JSON_VALUE, MediaType.TEXT_EVENT_STREAM_VALUE})
    public ArkResponse chatWithPostgres(ArkRequest arkRequest) {

      String contextId = arkRequest.getQueryParam("id");
      String query = arkRequest.getQueryParam("query");
      String table = arkRequest.getQueryParam("table");
      boolean stream = arkRequest.getBooleanHeader("stream");

      System.out.println(contextId);
      System.out.println(query);
      System.out.println(table);
      System.out.println(stream);

      RedisHistoryContextEndpoint contextEndpoint =
          new RedisHistoryContextEndpoint(new FixedDelay(3, 3, TimeUnit.SECONDS));
      HistoryContext historyContext =
          EdgeChain.fromObservable(contextEndpoint.get(contextId)).get();

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
          new PostgresEndpoint(
              POSTGRES_JDBC_URL,
              POSTGRES_USERNAME,
              POSTGRES_PASSWORD,
              table,
              new FixedDelay(5, 10, TimeUnit.SECONDS));

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

    @DeleteMapping("/postgres/deleteAll")
    public ArkResponse deletePostgres(ArkRequest arkRequest) {
      String table = arkRequest.getQueryParam("table");

      PostgresEndpoint postgresEndpoint =
          new PostgresEndpoint(
              POSTGRES_JDBC_URL,
              POSTGRES_USERNAME,
              POSTGRES_PASSWORD,
              table,
              new FixedDelay(5, 10, TimeUnit.SECONDS));

      return new EdgeChain<>(postgresEndpoint.deleteAll()).getArkResponse();
    }
  }

  /************ EXAMPLE APIs **********************/

}
