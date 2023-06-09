package com.edgechain.app.controllers.redis;

import static com.edgechain.app.constants.WebConstants.*;

import com.edgechain.app.chains.retrieval.RedisRetrievalChain;
import com.edgechain.app.chains.retrieval.RetrievalChain;
import com.edgechain.app.services.EmbeddingService;
import com.edgechain.app.services.OpenAiService;
import com.edgechain.app.services.PromptService;
import com.edgechain.app.services.index.RedisService;
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
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/v1/redis/doc2vec")
public class RedisDoc2VecController {

  @Autowired private EmbeddingService embeddingService;
  @Autowired private RedisService redisService;
  @Autowired private PromptService promptService;
  @Autowired private OpenAiService openAiService;
  @Autowired private RedisHistoryContextService redisHistoryContextService;
  @Autowired private PdfReader pdfReader;

  @PostMapping(value = "/upsert", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public void upsertByChunk(@RequestParam(value = "file") MultipartFile file) throws IOException {

    String[] arr = pdfReader.readByChunkSize(file.getInputStream(), 512);
    RetrievalChain retrievalChain = new RedisRetrievalChain(embeddingService, redisService);

    IntStream.range(0, arr.length).parallel().forEach(i -> retrievalChain.upsert(arr[i]));
  }

  @PostMapping("/query")
  public Mono<List<ChainResponse>> query(@RequestBody HashMap<String, String> mapper) {

    Endpoint chatEndpoint =
        new Endpoint(
            OPENAI_CHAT_COMPLETION_API,
            OPENAI_AUTH_KEY,
            "gpt-3.5-turbo",
            "user",
            0.3,
            new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

    RetrievalChain retrievalChain =
        new RedisRetrievalChain(
            chatEndpoint, embeddingService, redisService, promptService, openAiService);

    return retrievalChain.query(mapper.get("query"), Integer.parseInt(mapper.get("topK")));
  }

  @PostMapping("/query/context/{contextId}")
  public Mono<ChainResponse> queryContextJson(
      @PathVariable String contextId, @RequestBody HashMap<String, String> mapper) {

    Endpoint chatEndpoint =
        new Endpoint(
            OPENAI_CHAT_COMPLETION_API,
            OPENAI_AUTH_KEY,
            "gpt-3.5-turbo",
            "user",
            0.6,
            new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

    RetrievalChain retrievalChain =
        new RedisRetrievalChain(
            chatEndpoint, embeddingService, redisService, promptService, openAiService);

    return retrievalChain.query(contextId, redisHistoryContextService, mapper.get("query"));
  }

  @PostMapping("/query/context/file/{contextId}")
  public Mono<ChainResponse> queryContextFile(
      @PathVariable String contextId, @RequestBody HashMap<String, String> mapper) {

    Endpoint chatEndpoint =
        new Endpoint(
            OPENAI_CHAT_COMPLETION_API,
            OPENAI_AUTH_KEY,
            "gpt-3.5-turbo",
            "user",
            0.7,
            new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

    RetrievalChain retrievalChain =
        new RedisRetrievalChain(
            chatEndpoint, embeddingService, redisService, promptService, openAiService);

    return retrievalChain.query(
        contextId,
        redisHistoryContextService,
        new LocalFileResourceHandler(mapper.get("folder"), mapper.get("filename")));
  }
}
