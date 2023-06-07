package com.edgechain.app.controllers.pinecone;

import com.edgechain.app.chains.abstracts.RetrievalChain;
import com.edgechain.app.chains.retrieval.openai.PineconeOpenAiRetrievalChain;
import com.edgechain.lib.context.services.impl.RedisHistoryContextService;
import com.edgechain.lib.reader.impl.PdfReader;
import com.edgechain.app.services.OpenAiService;
import com.edgechain.app.services.PromptService;
import com.edgechain.app.services.embeddings.EmbeddingService;
import com.edgechain.app.services.index.PineconeService;
import com.edgechain.lib.openai.endpoint.Endpoint;
import com.edgechain.lib.resource.impl.LocalFileResourceHandler;
import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.lib.rxjava.retry.impl.ExponentialDelay;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import reactor.core.publisher.Mono;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.stream.IntStream;

import static com.edgechain.app.constants.WebConstants.*;

@RestController
@RequestMapping("/v1/pinecone/openai")
public class PineconeOpenAiController {

    @Autowired private EmbeddingService embeddingService;
    @Autowired private OpenAiService openAiService;
    @Autowired private PromptService promptService;
    @Autowired private PineconeService pineconeService;

    @Autowired private RedisHistoryContextService redisHistoryContextService;

    @Autowired private PdfReader pdfReader;

    @PostMapping(value = "/upsert", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public void upsertByChunk(@RequestParam(value = "file") MultipartFile file) throws IOException {

        String[] arr = pdfReader.readByChunkSize(file.getInputStream(), 512);
        IntStream.range(0, arr.length)
                .parallel()
                .forEach(
                        i -> {
                            Endpoint embeddingEndpoint =
                                    new Endpoint(
                                            OPENAI_EMBEDDINGS_API,
                                            OPENAI_AUTH_KEY,
                                            "text-embedding-ada-002",
                                            new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

                            Endpoint pineconeEndpoint =
                                    new Endpoint(
                                            PINECONE_UPSERT_API,
                                            PINECONE_AUTH_KEY,
                                            new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

                            RetrievalChain retrievalChain =
                                    new PineconeOpenAiRetrievalChain
                                            (embeddingEndpoint, pineconeEndpoint, embeddingService, pineconeService);

                            retrievalChain.upsert(arr[i]);
                        });
    }



    @PostMapping("/query")
    public Mono<List<ChainResponse>> query(@RequestBody HashMap<String, String> mapper) {

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
                        0.3,
                        new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

        RetrievalChain retrievalChain =
                new PineconeOpenAiRetrievalChain(
                        embeddingEndpoint,
                        pineconeEndpoint,
                        chatEndpoint,
                        embeddingService,
                        pineconeService,
                        promptService,
                        openAiService
                        );
        return retrievalChain.query(mapper.get("query"), Integer.parseInt(mapper.get("topK")));
    }

    @PostMapping("/query/context/{contextId}")
    public Mono<ChainResponse> queryContextJson(@PathVariable String contextId,  @RequestBody HashMap<String, String> mapper) {

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
                new PineconeOpenAiRetrievalChain(
                        embeddingEndpoint,
                        pineconeEndpoint,
                        chatEndpoint,
                        embeddingService,
                        pineconeService,
                        promptService,
                        openAiService
                );
        return retrievalChain.query(
                contextId,
                redisHistoryContextService,
                mapper.get("query"));
    }

    @PostMapping("/query/context/file/{contextId}")
    public Mono<ChainResponse> queryContextFile(@PathVariable String contextId, @RequestBody HashMap<String, String> mapper) {

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
                new PineconeOpenAiRetrievalChain(
                        embeddingEndpoint,
                        pineconeEndpoint,
                        chatEndpoint,
                        embeddingService,
                        pineconeService,
                        promptService,
                        openAiService
                );

        return retrievalChain.query(
                contextId,
                redisHistoryContextService,
                new LocalFileResourceHandler(mapper.get("folder"), mapper.get("filename")));


    }

}
