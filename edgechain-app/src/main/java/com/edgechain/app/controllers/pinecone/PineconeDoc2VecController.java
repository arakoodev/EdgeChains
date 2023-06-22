package com.edgechain.app.controllers.pinecone;

import static com.edgechain.app.constants.WebConstants.*;

import com.edgechain.app.chains.retrieval.PineconeRetrievalChain;
import com.edgechain.app.chains.retrieval.RetrievalChain;
import com.edgechain.app.services.EmbeddingService;
import com.edgechain.app.services.OpenAiService;
import com.edgechain.app.services.PromptService;
import com.edgechain.app.services.index.PineconeService;
import com.edgechain.lib.context.services.impl.RedisHistoryContextService;
import com.edgechain.lib.openai.endpoint.Endpoint;
import com.edgechain.lib.reader.impl.PdfReader;
import com.edgechain.lib.resource.impl.LocalFileResourceHandler;
import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.lib.rxjava.retry.impl.ExponentialDelay;
import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.stream.IntStream;

import io.reactivex.rxjava3.core.Single;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/v1/pinecone/doc2vec")
public class PineconeDoc2VecController {

  @Autowired private EmbeddingService embeddingService;
  @Autowired private OpenAiService openAiService;
  @Autowired private PromptService promptService;
  @Autowired private PineconeService pineconeService;
  @Autowired private RedisHistoryContextService redisHistoryContextService;

  @Autowired private PdfReader pdfReader;

  @PostMapping(value = "/upsert", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public void upsert(@RequestBody MultipartFile file) throws IOException {

    Endpoint pineconeEndpoint =
        new Endpoint(
            PINECONE_UPSERT_API,
            PINECONE_AUTH_KEY,
            new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

    RetrievalChain retrievalChain =
        new PineconeRetrievalChain(pineconeEndpoint, embeddingService, pineconeService);

    String[] arr = pdfReader.readByChunkSize(file.getInputStream(), 512);
    IntStream.range(0, arr.length)
        .parallel()
        .forEach(
            i -> {
              retrievalChain.upsert(arr[i]);
            });
  }

  @PostMapping("/query")
  public Single<List<ChainResponse>> queryWithDoc2Vec(@RequestBody HashMap<String, String> mapper) {

    Endpoint pineconeEndpoint = new Endpoint(PINECONE_QUERY_API, PINECONE_AUTH_KEY);

    Endpoint chatEndpoint =
        new Endpoint(
            OPENAI_CHAT_COMPLETION_API,
            OPENAI_AUTH_KEY,
            "gpt-3.5-turbo",
            "user",
            0.7,
            false,
            new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

    RetrievalChain retrievalChain =
        new PineconeRetrievalChain(
            pineconeEndpoint,
            chatEndpoint,
            embeddingService,
            pineconeService,
            promptService,
            openAiService);

    return retrievalChain.query(mapper.get("query"), Integer.parseInt(mapper.get("topK")));
  }

  @PostMapping("/query/context/{contextId}")
  public Single<ChainResponse> queryContextJson(
      @PathVariable String contextId, @RequestBody HashMap<String, String> mapper) {

    Endpoint pineconeEndpoint =
        new Endpoint(
            PINECONE_QUERY_API, PINECONE_AUTH_KEY, new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

    Endpoint chatEndpoint =
        new Endpoint(
            OPENAI_CHAT_COMPLETION_API,
            OPENAI_AUTH_KEY,
            "gpt-3.5-turbo",
            "user",
            0.6,
            false,
            new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

    RetrievalChain retrievalChain =
        new PineconeRetrievalChain(
            pineconeEndpoint,
            chatEndpoint,
            embeddingService,
            pineconeService,
            promptService,
            openAiService);

    return retrievalChain.query(contextId, redisHistoryContextService, mapper.get("query"));
  }

  @PostMapping("/query/context/file/{contextId}")
  public Single<ChainResponse> queryContextFile(
      @PathVariable String contextId, @RequestBody HashMap<String, String> mapper) {

    Endpoint pineconeEndpoint =
        new Endpoint(
            PINECONE_QUERY_API, PINECONE_AUTH_KEY, new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

    Endpoint chatEndpoint =
        new Endpoint(
            OPENAI_CHAT_COMPLETION_API,
            OPENAI_AUTH_KEY,
            "gpt-3.5-turbo",
            "user",
            0.7,
            false,
            new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

    RetrievalChain retrievalChain =
        new PineconeRetrievalChain(
            pineconeEndpoint,
            chatEndpoint,
            embeddingService,
            pineconeService,
            promptService,
            openAiService);

    return retrievalChain.query(
        contextId,
        redisHistoryContextService,
        new LocalFileResourceHandler(mapper.get("folder"), mapper.get("filename")));
  }
}
