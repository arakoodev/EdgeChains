package com.edgechain;

import com.edgechain.lib.chains.PineconeRetrieval;
import com.edgechain.lib.chains.RedisRetrieval;
import com.edgechain.lib.chains.retrieval.Retrieval;
import com.edgechain.lib.constants.WebConstants;
import com.edgechain.lib.configuration.EdgeChainAutoConfiguration;

import java.io.*;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.IntStream;

import com.edgechain.lib.context.services.HistoryContextService;
import com.edgechain.lib.context.services.impl.RedisHistoryContextService;
import com.edgechain.lib.feign.EmbeddingService;
import com.edgechain.lib.feign.OpenAiService;
import com.edgechain.lib.feign.OpenAiStreamService;
import com.edgechain.lib.feign.WikiService;
import com.edgechain.lib.feign.index.PineconeService;
import com.edgechain.lib.feign.index.RedisService;
import com.edgechain.lib.jsonnet.JsonnetArgs;
import com.edgechain.lib.jsonnet.JsonnetLoader;
import com.edgechain.lib.jsonnet.enums.DataType;
import com.edgechain.lib.jsonnet.impl.FileJsonnetLoader;
import com.edgechain.lib.jsonnet.mapper.ServiceMapper;
import com.edgechain.lib.jsonnet.schemas.Schema;
import com.edgechain.lib.jsonnet.schemas.ChatSchema;
import com.edgechain.lib.openai.endpoint.Endpoint;
import com.edgechain.lib.reader.impl.PdfReader;
import com.edgechain.lib.request.OpenAiChatRequest;
import com.edgechain.lib.request.OpenAiEmbeddingsRequest;
import com.edgechain.lib.request.PineconeRequest;
import com.edgechain.lib.request.RedisRequest;
import com.edgechain.lib.response.ArkResponse;
import com.edgechain.lib.response.ArkEmitter;
import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.lib.rxjava.retry.impl.ExponentialDelay;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import com.edgechain.lib.rxjava.utils.AtomInteger;
import io.reactivex.rxjava3.core.Observable;
import org.deeplearning4j.models.embeddings.loader.WordVectorSerializer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.openfeign.FeignAutoConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import scala.Tuple2;
import scala.Tuple3;

import static com.edgechain.lib.constants.WebConstants.*;
import static com.edgechain.lib.rxjava.transformer.observable.EdgeChain.create;

@SpringBootApplication
@ImportAutoConfiguration({ FeignAutoConfiguration.class })
@Import(EdgeChainAutoConfiguration.class)
public class EdgeChainApplication implements CommandLineRunner {

        public static final Logger logger = LoggerFactory.getLogger(EdgeChainApplication.class);

        public static void main(String[] args) throws Exception {

                String host = "http://localhost";
                String port = "8080";

                System.setProperty("server.port", port);
                System.setProperty("server.url", String.format("%s:%s%s", host, port, SERVICE_CONTEXT_PATH));

                System.setProperty("OPENAI_AUTH_KEY", "");

                System.setProperty("PINECONE_AUTH_KEY", "");
                System.setProperty(
                                "PINECONE_QUERY_API", "");
                System.setProperty(
                                "PINECONE_UPSERT_API",
                                "");
                System.setProperty(
                                "PINECONE_DELETE_API",
                                "");

                System.setProperty(
                                "spring.data.redis.host", "");
                System.setProperty("spring.data.redis.port", "12285");
                System.setProperty("spring.data.redis.username", "default");
                System.setProperty("spring.data.redis.password", "");
                System.setProperty("spring.data.redis.connect-timeout", "120000");
                System.setProperty("spring.redis.ttl", "3600");
                System.setProperty("doc2vec.filepath", "./doc2vec.bin");

                loadSentenceModel();
                readDoc2Vec();

                SpringApplication.run(EdgeChainApplication.class, args);
        }

        public static void loadSentenceModel() throws IOException {
                WebConstants.sentenceModel = EdgeChainApplication.class.getResourceAsStream("/en-sent.zip");
                if (Objects.isNull(WebConstants.sentenceModel)) {
                        logger.error("en-sent.zip file isn't loaded from the resources.'");
                }
        }

        public static void readDoc2Vec() throws Exception {

                String modelPath = System.getProperty("doc2vec.filepath");

                File file = new File(modelPath);

                if (!file.exists()) {
                        logger.warn(
                                        "It seems like, you haven't trained the model or correctly specified Doc2Vec model"
                                                        + " path.");
                } else {
                        logger.info("Loading...");
                        WebConstants.embeddingDoc2VecModel = WordVectorSerializer
                                        .readParagraphVectors(new FileInputStream(modelPath));
                        logger.info("Doc2Vec model is successfully loaded...");
                }
        }

        @Override
        public void run(String... args) throws Exception {
        }

        /************ EXAMPLE APIs **********************/

        @RestController
        @RequestMapping("/v1/wiki")
        public class WikiController {

                @GetMapping(value = "/summary", produces = { MediaType.APPLICATION_JSON_VALUE,
                                MediaType.TEXT_EVENT_STREAM_VALUE })
                public Object wikiSummary(@RequestParam String query, @RequestParam Boolean stream) {

                        HashMap<String, JsonnetArgs> parameters = new HashMap<>();
                        parameters.put("keepMaxTokens", new JsonnetArgs(DataType.BOOLEAN, "true"));
                        parameters.put("maxTokens", new JsonnetArgs(DataType.INTEGER, "4096"));

                        // Step 1: Create JsonnetLoader
                        JsonnetLoader loader = new FileJsonnetLoader("./wiki.jsonnet");
                        Schema schema = loader.loadOrReload(parameters, Schema.class);

                        // Step 2: Create Endpoint For ChatCompletion;
                        Endpoint chatEndpoint = new Endpoint(
                                        OPENAI_CHAT_COMPLETION_API,
                                        OPENAI_AUTH_KEY,
                                        "gpt-3.5-turbo",
                                        "user",
                                        0.3,
                                        stream,
                                        new ExponentialDelay(3, 5, 2, TimeUnit.SECONDS));

                        // Step 3: Fetch WikiService Defined In Jsonnet
                        WikiService wikiService = new ServiceMapper().map(schema, "wikiService", WikiService.class);

                        // Fetch OpenAI Service Defined In Jsonnet
                        OpenAiService openAiService = new ServiceMapper().map(schema, "openAiService",
                                        OpenAiService.class);

                        // Fetch OpenAIStream Service Defined In Jsonnet
                        OpenAiStreamService openAiStreamService = new ServiceMapper().map(schema, "openAiStreamService",
                                        OpenAiStreamService.class);

                        EdgeChain<String> edgeChain = create(wikiService.getPageContent(query).getResponse())
                                        .transform(
                                                        wikiOutput -> {
                                                                parameters.put("keepContext", new JsonnetArgs(
                                                                                DataType.BOOLEAN, "true"));
                                                                parameters.put("context", new JsonnetArgs(
                                                                                DataType.STRING, wikiOutput));

                                                                Schema schema_ = loader.loadOrReload(parameters,
                                                                                Schema.class);
                                                                return schema_.getPrompt();
                                                        });

                        if (chatEndpoint.getStream())
                                return edgeChain
                                                .transform(
                                                                prompt -> openAiStreamService.chatCompletion(
                                                                                new OpenAiChatRequest(chatEndpoint,
                                                                                                prompt)))
                                                .getArkResponse();
                        else
                                return edgeChain
                                                .transform(
                                                                prompt -> openAiService.chatCompletion(
                                                                                new OpenAiChatRequest(chatEndpoint,
                                                                                                prompt)))
                                                .getArkResponse();
                }
        }

        @RestController
        @RequestMapping("/v1/pinecone")
        public class PineconeController {

                @Autowired
                private PineconeService pineconeService;

                @DeleteMapping("/deleteAll")
                public ChainResponse delete() {

                        Endpoint pineconeEndpoint = new Endpoint(
                                        PINECONE_DELETE_API,
                                        PINECONE_AUTH_KEY,
                                        new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

                        return this.pineconeService.deleteAll(new PineconeRequest(pineconeEndpoint));
                }
        }

        @RestController
        @RequestMapping("/v1/history-context")
        public class RedisHistoryContextController {

                @Autowired
                private RedisHistoryContextService historyContextService;

                @GetMapping("/create")
                public ArkResponse<?> create() {
                        return new ArkResponse<>(historyContextService.create().getScheduledObservableWithRetry());
                }

                @GetMapping("/{id}")
                public ArkResponse<?> findById(@PathVariable String id) {
                        return new ArkResponse<>(historyContextService.get(id).getScheduledObservableWithRetry());
                }

                @DeleteMapping("/{id}")
                public ArkResponse<?> delete(@PathVariable String id) {
                        return new ArkResponse<>(historyContextService.delete(id).getScheduledObservableWithRetry());
                }
        }

        @RestController
        @RequestMapping("/v1/pinecone/openai")
        public class PineconeOpenAiController {

                @Autowired
                private PdfReader pdfReader;

                @PostMapping(value = "/upsert", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
                public void upsertByChunk(@RequestParam(value = "file") MultipartFile file) throws IOException {

                        JsonnetLoader loader = new FileJsonnetLoader("./pinecone-query.jsonnet");
                        Schema schema = loader.loadOrReload(new HashMap<>(), Schema.class);

                        EmbeddingService embeddingService = new ServiceMapper().map(schema, "embeddingService",
                                        EmbeddingService.class);
                        PineconeService pineconeService = new ServiceMapper().map(schema, "pineconeService",
                                        PineconeService.class);

                        String[] arr = pdfReader.readByChunkSize(file.getInputStream(), 512);

                        Endpoint embeddingEndpoint = new Endpoint(
                                        OPENAI_EMBEDDINGS_API,
                                        OPENAI_AUTH_KEY,
                                        "text-embedding-ada-002",
                                        new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

                        Endpoint pineconeEndpoint = new Endpoint(
                                        PINECONE_UPSERT_API,
                                        PINECONE_AUTH_KEY,
                                        new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

                        Retrieval retrieval = new PineconeRetrieval(
                                        pineconeEndpoint, embeddingEndpoint, embeddingService, pineconeService);

                        IntStream.range(0, arr.length).parallel().forEach(i -> retrieval.upsert(arr[i]));
                }

                @GetMapping(value = "/query", produces = { MediaType.APPLICATION_JSON_VALUE,
                                MediaType.TEXT_EVENT_STREAM_VALUE })
                public Object query(
                                @RequestParam Integer topK, @RequestParam Boolean stream, @RequestParam String query) {

                        HashMap<String, JsonnetArgs> parameters = new HashMap<>();
                        parameters.put("keepMaxTokens", new JsonnetArgs(DataType.BOOLEAN, "true"));
                        parameters.put("maxTokens", new JsonnetArgs(DataType.INTEGER, "4096"));

                        JsonnetLoader loader = new FileJsonnetLoader("./pinecone-query.jsonnet");
                        Schema schema = loader.loadOrReload(parameters, Schema.class);

                        Endpoint chatEndpoint = new Endpoint(
                                        OPENAI_CHAT_COMPLETION_API,
                                        OPENAI_AUTH_KEY,
                                        "gpt-3.5-turbo",
                                        "user",
                                        0.7,
                                        new ExponentialDelay(3, 5, 2, TimeUnit.SECONDS));

                        Endpoint embeddingEndpoint = new Endpoint(
                                        OPENAI_EMBEDDINGS_API,
                                        OPENAI_AUTH_KEY,
                                        "text-embedding-ada-002",
                                        new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

                        Endpoint pineconeEndpoint = new Endpoint(
                                        PINECONE_QUERY_API,
                                        PINECONE_AUTH_KEY,
                                        new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

                        PineconeService pineconeService = new ServiceMapper().map(schema, "pineconeService",
                                        PineconeService.class);
                        EmbeddingService embeddingService = new ServiceMapper().map(schema, "embeddingService",
                                        EmbeddingService.class);
                        OpenAiService openAiService = new ServiceMapper().map(schema, "openAiService",
                                        OpenAiService.class);

                        if (stream) {

                                System.out.println("Using Stream");

                                String[] pineconeQueries = create(
                                                embeddingService
                                                                .openAi(new OpenAiEmbeddingsRequest(embeddingEndpoint,
                                                                                query))
                                                                .getResponse())
                                                .transform(
                                                                embeddingOutput -> pineconeService
                                                                                .query(new PineconeRequest(
                                                                                                pineconeEndpoint,
                                                                                                embeddingOutput, topK))
                                                                                .getResponse())
                                                .transform(pineconeOutput -> pineconeOutput.split("\n"))
                                                .getWithOutRetry();

                                AtomInteger currentTopK = AtomInteger.of(0);

                                return new EdgeChain<>(
                                                Observable.create(
                                                                emitter -> {
                                                                        try {
                                                                                String input = pineconeQueries[currentTopK
                                                                                                .getAndIncrement()];

                                                                                parameters.put("keepContext",
                                                                                                new JsonnetArgs(DataType.BOOLEAN,
                                                                                                                "true"));
                                                                                parameters.put("context",
                                                                                                new JsonnetArgs(DataType.STRING,
                                                                                                                input));

                                                                                Schema schema_ = loader.loadOrReload(
                                                                                                parameters,
                                                                                                Schema.class);

                                                                                emitter.onNext(
                                                                                                openAiService.chatCompletion(
                                                                                                                new OpenAiChatRequest(
                                                                                                                                chatEndpoint,
                                                                                                                                schema_.getPrompt())));
                                                                                emitter.onComplete();

                                                                        } catch (final Exception e) {
                                                                                emitter.onError(e);
                                                                        }
                                                                }))
                                                .doWhileLoop(() -> currentTopK.get() == ((int) topK))
                                                .getArkEmitter();
                        } else {
                                // Creation of Chains
                                return create(
                                                embeddingService
                                                                .openAi(new OpenAiEmbeddingsRequest(embeddingEndpoint,
                                                                                query))
                                                                .getResponse())
                                                .transform(
                                                                embeddingOutput -> pineconeService
                                                                                .query(new PineconeRequest(
                                                                                                pineconeEndpoint,
                                                                                                embeddingOutput, topK))
                                                                                .getResponse())
                                                .transform(
                                                                pineconeOutput -> {
                                                                        List<ChainResponse> output = new ArrayList<>();

                                                                        StringTokenizer tokenizer = new StringTokenizer(
                                                                                        pineconeOutput, "\n");
                                                                        while (tokenizer.hasMoreTokens()) {

                                                                                String response = tokenizer.nextToken();
                                                                                // Use jsonnet loader
                                                                                parameters.put("keepContext",
                                                                                                new JsonnetArgs(DataType.BOOLEAN,
                                                                                                                "true"));
                                                                                parameters.put("context",
                                                                                                new JsonnetArgs(DataType.STRING,
                                                                                                                response));

                                                                                Schema schema_ = loader.loadOrReload(
                                                                                                parameters,
                                                                                                Schema.class);
                                                                                output.add(
                                                                                                openAiService.chatCompletion(
                                                                                                                new OpenAiChatRequest(
                                                                                                                                chatEndpoint,
                                                                                                                                schema_.getPrompt())));
                                                                        }

                                                                        return output;
                                                                })
                                                .getArkResponse();
                        }
                }

                /**
                 *
                 * @param contextId
                 * @param stream
                 * @param query
                 * @return ArkResponse
                 */
                @GetMapping(value = "/query/context", produces = { MediaType.APPLICATION_JSON_VALUE,
                                MediaType.TEXT_EVENT_STREAM_VALUE })
                public Object queryWithChatHistory(
                                @RequestParam String contextId, @RequestParam Boolean stream,
                                @RequestParam String query) {

                        HashMap<String, JsonnetArgs> parameters = new HashMap<>();

                        parameters.put("keepMaxTokens", new JsonnetArgs(DataType.BOOLEAN, "true"));
                        parameters.put("maxTokens", new JsonnetArgs(DataType.INTEGER, "4096"));
                        parameters.put("query", new JsonnetArgs(DataType.STRING, query));
                        parameters.put("keepHistory", new JsonnetArgs(DataType.BOOLEAN, "false"));

                        JsonnetLoader loader = new FileJsonnetLoader("./pinecone-chat.jsonnet");
                        ChatSchema schema = loader.loadOrReload(parameters, ChatSchema.class);

                        Endpoint embeddingEndpoint = new Endpoint(
                                        OPENAI_EMBEDDINGS_API,
                                        OPENAI_AUTH_KEY,
                                        "text-embedding-ada-002",
                                        new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

                        Endpoint pineconeEndpoint = new Endpoint(
                                        PINECONE_QUERY_API,
                                        PINECONE_AUTH_KEY,
                                        new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

                        Endpoint chatEndpoint = new Endpoint(
                                        OPENAI_CHAT_COMPLETION_API,
                                        OPENAI_AUTH_KEY,
                                        "gpt-3.5-turbo",
                                        "user",
                                        0.7,
                                        stream,
                                        new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

                        PineconeService pineconeService = new ServiceMapper().map(schema, "pineconeService",
                                        PineconeService.class);
                        EmbeddingService embeddingService = new ServiceMapper().map(schema, "embeddingService",
                                        EmbeddingService.class);
                        OpenAiService openAiService = new ServiceMapper().map(schema, "openAiService",
                                        OpenAiService.class);
                        OpenAiStreamService openAiStreamService = new ServiceMapper().map(schema, "openAiStreamService",
                                        OpenAiStreamService.class);
                        HistoryContextService contextService = new ServiceMapper().map(schema, "historyContextService",
                                        HistoryContextService.class);

                        // Creating Chains
                        EdgeChain<Tuple2<String, String>> edgeChain = create(
                                        embeddingService
                                                        .openAi(new OpenAiEmbeddingsRequest(embeddingEndpoint, query))
                                                        .getResponse())
                                        .transform(
                                                        embeddingOutput -> pineconeService
                                                                        .query(
                                                                                        new PineconeRequest(
                                                                                                        pineconeEndpoint,
                                                                                                        embeddingOutput,
                                                                                                        schema.getTopK()))
                                                                        .getResponse())
                                        .transform(
                                                        pineconeOutput -> {
                                                                System.out.printf("Query %s-%s", schema.getTopK(),
                                                                                pineconeOutput);

                                                                // Query, Preset, PineconeOutput, ChatHistory
                                                                String chatHistory = contextService.get(contextId)
                                                                                .getWithRetry().getResponse();

                                                                parameters.put("keepHistory", new JsonnetArgs(
                                                                                DataType.BOOLEAN, "true"));
                                                                parameters.put("history", new JsonnetArgs(
                                                                                DataType.STRING, chatHistory));

                                                                parameters.put("keepContext", new JsonnetArgs(
                                                                                DataType.BOOLEAN, "true"));
                                                                parameters.put("context", new JsonnetArgs(
                                                                                DataType.STRING, pineconeOutput));

                                                                ChatSchema schema_ = loader.loadOrReload(parameters,
                                                                                ChatSchema.class);

                                                                // ChatHistory, Prompt
                                                                return new Tuple2<>(chatHistory, schema_.getPrompt());
                                                        });

                        if (chatEndpoint.getStream()) {

                                Tuple2<String, String> tuple2 = edgeChain.getWithOutRetry();

                                System.out.println("\nPrompt: \n" + tuple2._2);

                                StringBuilder openAiResponseBuilder = new StringBuilder();
                                return new ArkEmitter<>(
                                                openAiStreamService.chatCompletion(
                                                                new OpenAiChatRequest(chatEndpoint, tuple2._2))
                                                                .doOnNext(
                                                                                v -> {
                                                                                        if (v.getResponse().equals(
                                                                                                        WebConstants.CHAT_STREAM_EVENT_COMPLETION_MESSAGE)) {
                                                                                                String redisHistory = query
                                                                                                                + openAiResponseBuilder
                                                                                                                                .toString()
                                                                                                                                .replaceAll("[\t\n\r]+",
                                                                                                                                                " ")
                                                                                                                + tuple2._1;
                                                                                                contextService.put(
                                                                                                                contextId,
                                                                                                                redisHistory)
                                                                                                                .getWithRetry();
                                                                                        } else {
                                                                                                openAiResponseBuilder
                                                                                                                .append(v.getResponse());
                                                                                        }
                                                                                }));

                        } else
                                return edgeChain
                                                .transform(
                                                                tuple2 -> {
                                                                        String openAiResponse = openAiService
                                                                                        .chatCompletion(new OpenAiChatRequest(
                                                                                                        chatEndpoint,
                                                                                                        tuple2._2))
                                                                                        .getResponse();

                                                                        contextService.put(contextId,
                                                                                        query + openAiResponse
                                                                                                        + tuple2._1)
                                                                                        .getWithRetry();

                                                                        return openAiResponse;
                                                                })
                                                .getArkResponse();
                }
        }

        @RestController
        @RequestMapping("/v1/redis/openai")
        public class RedisOpenAiController {

                @Autowired
                private PdfReader pdfReader;

                @PostMapping(value = "/upsert", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
                public void upsertByChunk(@RequestParam(value = "file") MultipartFile file) throws IOException {

                        JsonnetLoader loader = new FileJsonnetLoader("./redis-query.jsonnet");
                        Schema schema = loader.loadOrReload(new HashMap<>(), Schema.class);

                        EmbeddingService embeddingService = new ServiceMapper().map(schema, "embeddingService",
                                        EmbeddingService.class);
                        RedisService redisService = new ServiceMapper().map(schema, "redisService", RedisService.class);

                        String[] arr = pdfReader.readByChunkSize(file.getInputStream(), 512);

                        Endpoint embeddingEndpoint = new Endpoint(
                                        OPENAI_EMBEDDINGS_API,
                                        OPENAI_AUTH_KEY,
                                        "text-embedding-ada-002",
                                        new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

                        Retrieval retrieval = new RedisRetrieval(embeddingEndpoint, embeddingService, redisService);

                        IntStream.range(0, arr.length).parallel().forEach(i -> retrieval.upsert(arr[i]));
                }

                @GetMapping(value = "/query", produces = { MediaType.APPLICATION_JSON_VALUE,
                                MediaType.TEXT_EVENT_STREAM_VALUE })
                public Object query(
                                @RequestParam Integer topK, @RequestParam Boolean stream, @RequestParam String query) {

                        HashMap<String, JsonnetArgs> parameters = new HashMap<>();
                        parameters.put("keepMaxTokens", new JsonnetArgs(DataType.BOOLEAN, "true"));
                        parameters.put("maxTokens", new JsonnetArgs(DataType.INTEGER, "4096"));

                        JsonnetLoader loader = new FileJsonnetLoader("./redis-query.jsonnet");
                        Schema schema = loader.loadOrReload(parameters, Schema.class);

                        Endpoint chatEndpoint = new Endpoint(
                                        OPENAI_CHAT_COMPLETION_API,
                                        OPENAI_AUTH_KEY,
                                        "gpt-3.5-turbo",
                                        "user",
                                        0.7,
                                        new ExponentialDelay(3, 5, 2, TimeUnit.SECONDS));

                        Endpoint embeddingEndpoint = new Endpoint(
                                        OPENAI_EMBEDDINGS_API,
                                        OPENAI_AUTH_KEY,
                                        "text-embedding-ada-002",
                                        new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

                        RedisService redisService = new ServiceMapper().map(schema, "redisService", RedisService.class);
                        EmbeddingService embeddingService = new ServiceMapper().map(schema, "embeddingService",
                                        EmbeddingService.class);
                        OpenAiService openAiService = new ServiceMapper().map(schema, "openAiService",
                                        OpenAiService.class);

                        if (stream) {

                                System.out.println("Using Stream");

                                String[] redisQueries = create(
                                                embeddingService
                                                                .openAi(new OpenAiEmbeddingsRequest(embeddingEndpoint,
                                                                                query))
                                                                .getResponse())
                                                .transform(
                                                                embeddingOutput -> redisService
                                                                                .query(new RedisRequest(embeddingOutput,
                                                                                                topK))
                                                                                .getResponse())
                                                .transform(redisOutput -> redisOutput.split("\n"))
                                                .getWithOutRetry();

                                AtomInteger currentTopK = AtomInteger.of(0);

                                return new EdgeChain<>(
                                                Observable.create(
                                                                emitter -> {
                                                                        try {
                                                                                String input = redisQueries[currentTopK
                                                                                                .getAndIncrement()];

                                                                                parameters.put("keepContext",
                                                                                                new JsonnetArgs(DataType.BOOLEAN,
                                                                                                                "true"));
                                                                                parameters.put("context",
                                                                                                new JsonnetArgs(DataType.STRING,
                                                                                                                input));

                                                                                Schema schema_ = loader.loadOrReload(
                                                                                                parameters,
                                                                                                Schema.class);

                                                                                emitter.onNext(
                                                                                                openAiService.chatCompletion(
                                                                                                                new OpenAiChatRequest(
                                                                                                                                chatEndpoint,
                                                                                                                                schema_.getPrompt())));
                                                                                emitter.onComplete();

                                                                        } catch (final Exception e) {
                                                                                emitter.onError(e);
                                                                        }
                                                                }))
                                                .doWhileLoop(() -> currentTopK.get() == ((int) topK))
                                                .getArkEmitter();
                        } else {
                                // Creation of Chains
                                return create(
                                                embeddingService
                                                                .openAi(new OpenAiEmbeddingsRequest(embeddingEndpoint,
                                                                                query))
                                                                .getResponse())
                                                .transform(
                                                                embeddingOutput -> redisService
                                                                                .query(new RedisRequest(embeddingOutput,
                                                                                                topK))
                                                                                .getResponse())
                                                .transform(
                                                                redisOutput -> {
                                                                        List<ChainResponse> output = new ArrayList<>();

                                                                        StringTokenizer tokenizer = new StringTokenizer(
                                                                                        redisOutput, "\n");
                                                                        while (tokenizer.hasMoreTokens()) {

                                                                                String response = tokenizer.nextToken();
                                                                                // Use jsonnet loader
                                                                                parameters.put("keepContext",
                                                                                                new JsonnetArgs(DataType.BOOLEAN,
                                                                                                                "true"));
                                                                                parameters.put("context",
                                                                                                new JsonnetArgs(DataType.STRING,
                                                                                                                response));

                                                                                Schema schema_ = loader.loadOrReload(
                                                                                                parameters,
                                                                                                Schema.class);
                                                                                output.add(
                                                                                                openAiService.chatCompletion(
                                                                                                                new OpenAiChatRequest(
                                                                                                                                chatEndpoint,
                                                                                                                                schema_.getPrompt())));
                                                                        }

                                                                        return output;
                                                                })
                                                .getArkResponse();
                        }
                }

                /**
                 *
                 * @param contextId
                 * @param stream
                 * @param query
                 * @return ArkResponse
                 */
                @GetMapping(value = "/query/context", produces = { MediaType.APPLICATION_JSON_VALUE,
                                MediaType.TEXT_EVENT_STREAM_VALUE })
                public Object queryWithChatHistory(
                                @RequestParam String contextId, @RequestParam Boolean stream,
                                @RequestParam String query) {

                        HashMap<String, JsonnetArgs> parameters = new HashMap<>();

                        parameters.put("keepMaxTokens", new JsonnetArgs(DataType.BOOLEAN, "true"));
                        parameters.put("maxTokens", new JsonnetArgs(DataType.INTEGER, "4096"));
                        parameters.put("query", new JsonnetArgs(DataType.STRING, query));
                        parameters.put("keepHistory", new JsonnetArgs(DataType.BOOLEAN, "false"));

                        JsonnetLoader loader = new FileJsonnetLoader("./redis-chat.jsonnet");
                        ChatSchema schema = loader.loadOrReload(parameters, ChatSchema.class);

                        Endpoint embeddingEndpoint = new Endpoint(
                                        OPENAI_EMBEDDINGS_API,
                                        OPENAI_AUTH_KEY,
                                        "text-embedding-ada-002",
                                        new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

                        Endpoint chatEndpoint = new Endpoint(
                                        OPENAI_CHAT_COMPLETION_API,
                                        OPENAI_AUTH_KEY,
                                        "gpt-3.5-turbo",
                                        "user",
                                        0.7,
                                        stream,
                                        new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

                        RedisService redisService = new ServiceMapper().map(schema, "redisService", RedisService.class);
                        EmbeddingService embeddingService = new ServiceMapper().map(schema, "embeddingService",
                                        EmbeddingService.class);
                        OpenAiService openAiService = new ServiceMapper().map(schema, "openAiService",
                                        OpenAiService.class);
                        OpenAiStreamService openAiStreamService = new ServiceMapper().map(schema, "openAiStreamService",
                                        OpenAiStreamService.class);
                        HistoryContextService contextService = new ServiceMapper().map(schema, "historyContextService",
                                        HistoryContextService.class);

                        // Creating Chains
                        EdgeChain<Tuple2<String, String>> edgeChain = create(
                                        embeddingService
                                                        .openAi(new OpenAiEmbeddingsRequest(embeddingEndpoint, query))
                                                        .getResponse())
                                        .transform(
                                                        embeddingOutput -> redisService
                                                                        .query(
                                                                                        new RedisRequest(
                                                                                                        embeddingOutput,
                                                                                                        schema.getTopK()))
                                                                        .getResponse())
                                        .transform(
                                                        redisOutput -> {
                                                                System.out.printf("Query %s-%s", schema.getTopK(),
                                                                                redisOutput);

                                                                // Query, Preset, RedisOutput, ChatHistory
                                                                String chatHistory = contextService.get(contextId)
                                                                                .getWithRetry().getResponse();

                                                                parameters.put("keepHistory", new JsonnetArgs(
                                                                                DataType.BOOLEAN, "true"));
                                                                parameters.put("history", new JsonnetArgs(
                                                                                DataType.STRING, chatHistory));

                                                                parameters.put("keepContext", new JsonnetArgs(
                                                                                DataType.BOOLEAN, "true"));
                                                                parameters.put("context", new JsonnetArgs(
                                                                                DataType.STRING, redisOutput));

                                                                ChatSchema schema_ = loader.loadOrReload(parameters,
                                                                                ChatSchema.class);

                                                                // ChatHistory, Prompt
                                                                return new Tuple2<>(chatHistory, schema_.getPrompt());
                                                        });

                        if (chatEndpoint.getStream()) {

                                Tuple2<String, String> tuple2 = edgeChain.getWithOutRetry();

                                System.out.println("\nPrompt: \n" + tuple2._2);

                                StringBuilder openAiResponseBuilder = new StringBuilder();
                                return new ArkEmitter<>(
                                                openAiStreamService.chatCompletion(
                                                                new OpenAiChatRequest(chatEndpoint, tuple2._2))
                                                                .doOnNext(
                                                                                v -> {
                                                                                        if (v.getResponse().equals(
                                                                                                        WebConstants.CHAT_STREAM_EVENT_COMPLETION_MESSAGE)) {
                                                                                                String redisHistory = query
                                                                                                                + openAiResponseBuilder
                                                                                                                                .toString()
                                                                                                                                .replaceAll("[\t\n\r]+",
                                                                                                                                                " ")
                                                                                                                + tuple2._1;
                                                                                                contextService.put(
                                                                                                                contextId,
                                                                                                                redisHistory)
                                                                                                                .getWithRetry();
                                                                                        } else {
                                                                                                openAiResponseBuilder
                                                                                                                .append(v.getResponse());
                                                                                        }
                                                                                }));

                        } else
                                return edgeChain
                                                .transform(
                                                                tuple2 -> {
                                                                        String openAiResponse = openAiService
                                                                                        .chatCompletion(new OpenAiChatRequest(
                                                                                                        chatEndpoint,
                                                                                                        tuple2._2))
                                                                                        .getResponse();

                                                                        contextService.put(contextId,
                                                                                        query + openAiResponse
                                                                                                        + tuple2._1)
                                                                                        .getWithRetry();

                                                                        return openAiResponse;
                                                                })
                                                .getArkResponse();
                }

        }

        /************ EXAMPLE APIs **********************/
}
