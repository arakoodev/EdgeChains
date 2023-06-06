package com.edgechain.app.controllers.pinecone;

import com.edgechain.app.chains.abstracts.RetrievalChain;
import com.edgechain.app.chains.retrieval.doc2vec.PineconeDoc2VecRetrievalChain;
import com.edgechain.app.chains.retrieval.openai.PineconeOpenAiRetrievalChain;
import com.edgechain.app.services.OpenAiService;
import com.edgechain.app.services.PromptService;
import com.edgechain.app.services.embeddings.EmbeddingService;
import com.edgechain.app.services.index.PineconeService;
import com.edgechain.lib.context.services.impl.RedisHistoryContextService;
import com.edgechain.lib.openai.endpoint.Endpoint;
import com.edgechain.lib.reader.impl.PdfReader;
import com.edgechain.lib.resource.impl.LocalFileResourceHandler;
import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.lib.rxjava.retry.impl.ExponentialDelay;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import reactor.core.publisher.Mono;

import java.util.HashMap;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.stream.IntStream;

import static com.edgechain.app.constants.WebConstants.*;

@RestController
@RequestMapping("/v1/pinecone/doc2vec")
public class PineconeDoc2VecController {

    @Autowired private EmbeddingService embeddingService;
    @Autowired private OpenAiService openAiService;
    @Autowired private PromptService promptService;
    @Autowired private PineconeService pineconeService;
    @Autowired private RedisHistoryContextService redisHistoryContextService;


    @PostMapping(value = "/upsert", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public void upsert(@RequestBody MultipartFile file) {

        PdfReader pdfReader = new PdfReader();

        String[] arr = pdfReader.readByChunkSize(file, 512);
        IntStream.range(0, arr.length)
                .parallel()
                .forEach(
                        i -> {
                            Endpoint pineconeEndpoint =
                                    new Endpoint(
                                            PINECONE_UPSERT_API,
                                            PINECONE_AUTH_KEY,
                                            new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

                            RetrievalChain retrievalChain = new PineconeDoc2VecRetrievalChain(pineconeEndpoint, embeddingService, pineconeService);
                            retrievalChain.upsert(arr[i]);
                        });
    }

    @PostMapping("/query")
    public Mono<List<ChainResponse>> queryWithDoc2Vec(@RequestBody HashMap<String, String> mapper) {

        Endpoint pineconeEndpoint = new Endpoint(
                PINECONE_QUERY_API, PINECONE_AUTH_KEY);

        Endpoint chatEndpoint =
                new Endpoint(
                        OPENAI_CHAT_COMPLETION_API,
                        OPENAI_AUTH_KEY,
                        "gpt-3.5-turbo",
                        "user",
                        0.7,
                        new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

        RetrievalChain retrievalChain = new PineconeDoc2VecRetrievalChain
                (pineconeEndpoint, chatEndpoint, embeddingService, pineconeService, promptService, openAiService );

        return retrievalChain.query(mapper.get("query"), Integer.parseInt(mapper.get("topK")), redisHistoryContextService);
    }


    @PostMapping("/query/context-json")
    public Mono<List<ChainResponse>> queryContextJson(@RequestBody HashMap<String, String> mapper) {

        Endpoint pineconeEndpoint = new Endpoint(
                PINECONE_QUERY_API,
                PINECONE_AUTH_KEY,
                new ExponentialDelay(3,3,2,TimeUnit.SECONDS)
        );

        Endpoint chatEndpoint =
                new Endpoint(
                        OPENAI_CHAT_COMPLETION_API,
                        OPENAI_AUTH_KEY,
                        "gpt-3.5-turbo",
                        "user",
                        0.6,
                        new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

        RetrievalChain retrievalChain =
                new PineconeDoc2VecRetrievalChain
                        (pineconeEndpoint, chatEndpoint, embeddingService, pineconeService, promptService, openAiService );

        return retrievalChain.query(mapper.get("query"), Integer.parseInt(mapper.get("topK")), redisHistoryContextService);
    }

    @PostMapping("/query/context-file")
    public Mono<ChainResponse> queryContextFile(@RequestBody HashMap<String, String> mapper) {

        Endpoint embeddingEndpoint =
                new Endpoint(
                        OPENAI_EMBEDDINGS_API,
                        OPENAI_AUTH_KEY,
                        "text-embedding-ada-002",
                        new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

        Endpoint pineconeEndpoint = new Endpoint(
                PINECONE_QUERY_API,
                PINECONE_AUTH_KEY,
                new ExponentialDelay(3,3,2,TimeUnit.SECONDS)
        );

        Endpoint chatEndpoint =
                new Endpoint(
                        OPENAI_CHAT_COMPLETION_API,
                        OPENAI_AUTH_KEY,
                        "gpt-3.5-turbo",
                        "user",
                        0.7,
                        new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

        RetrievalChain retrievalChain =
                new PineconeDoc2VecRetrievalChain
                        (pineconeEndpoint, chatEndpoint, embeddingService, pineconeService, promptService, openAiService );

        return retrievalChain.query(
                mapper.get("query"),
                Integer.parseInt(mapper.get("topK")),
                redisHistoryContextService,
                new LocalFileResourceHandler(mapper.get("folder"), mapper.get("filename")));

    }

}
