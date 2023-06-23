package com.edgechain.app.controllers.redis;

import static com.edgechain.app.constants.WebConstants.*;

import com.edgechain.app.chains.retrieval.RedisRetrievalChain;
import com.edgechain.app.chains.retrieval.RetrievalChain;
import com.edgechain.app.chains.retrieval.sse.RedisRetrievalEventStreamChain;
import com.edgechain.app.chains.retrieval.sse.RetrievalEventStreamChain;
import com.edgechain.app.services.EmbeddingService;
import com.edgechain.app.services.OpenAiService;
import com.edgechain.app.services.PromptService;
import com.edgechain.app.services.index.RedisService;
import com.edgechain.app.services.streams.OpenAiStreamService;
import com.edgechain.lib.context.services.impl.RedisHistoryContextService;
import com.edgechain.lib.openai.endpoint.Endpoint;
import com.edgechain.lib.reader.impl.PdfReader;
import com.edgechain.lib.resource.impl.LocalFileResourceHandler;
import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.lib.rxjava.retry.impl.ExponentialDelay;
import java.util.HashMap;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.stream.IntStream;

import io.reactivex.rxjava3.core.Observable;
import io.reactivex.rxjava3.core.Single;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/v1/redis/openai")
public class RedisOpenAiController {

  @Autowired private EmbeddingService embeddingService;
  @Autowired private RedisService redisService;
  @Autowired private PromptService promptService;
  @Autowired private OpenAiService openAiService;
  @Autowired private OpenAiStreamService openAiStreamService;
  @Autowired private RedisHistoryContextService contextService;
  @Autowired private PdfReader pdfReader;

  @PostMapping(value = "/upsert", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public void upsertByChunk(@RequestParam(value = "file") MultipartFile file) throws Exception {

    //    String[] arr = pdfReader.readBySentence(WebConstants.sentenceModel,
    // file.getInputStream());
    Endpoint embeddingEndpoint =
        new Endpoint(
            OPENAI_EMBEDDINGS_API,
            OPENAI_AUTH_KEY,
            "text-embedding-ada-002",
            new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

    RetrievalChain retrievalChain =
        new RedisRetrievalChain(embeddingEndpoint, embeddingService, redisService);

    String[] arr = pdfReader.readByChunkSize(file.getInputStream(), 512);
    IntStream.range(0, arr.length).parallel().forEach(i -> retrievalChain.upsert(arr[i]));
  }

  @GetMapping(value = "/query", produces = {MediaType.APPLICATION_JSON_VALUE, MediaType.TEXT_EVENT_STREAM_VALUE})
  public Observable<?> query(@RequestParam Integer topK, @RequestParam Boolean stream, @RequestParam String query) {

    Endpoint embeddingEndpoint =
        new Endpoint(
            OPENAI_EMBEDDINGS_API,
            OPENAI_AUTH_KEY,
            "text-embedding-ada-002",
            new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

    Endpoint chatEndpoint =
        new Endpoint(
            OPENAI_CHAT_COMPLETION_API,
            OPENAI_AUTH_KEY,
            "gpt-3.5-turbo",
            "user",
            0.3,
            stream,
            new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

    if(chatEndpoint.getStream().equals(Boolean.FALSE)) {
      RetrievalChain retrievalChain =
              new RedisRetrievalChain(
                      embeddingEndpoint,
                      chatEndpoint,
                      embeddingService,
                      redisService,
                      promptService,
                      openAiService);

      return retrievalChain.query(query,topK);
    }

    else {
      RetrievalEventStreamChain retrievalEventStreamChain =
              new RedisRetrievalEventStreamChain(
                      embeddingEndpoint, chatEndpoint, embeddingService, redisService, promptService);

      return retrievalEventStreamChain.query(openAiService, query, topK);
    }

  }

  @GetMapping(value = "/query/context", produces = {MediaType.APPLICATION_JSON_VALUE, MediaType.TEXT_EVENT_STREAM_VALUE})
  public Observable<?> queryWithContext(
          @RequestParam String contextId,
          @RequestParam Integer topK,
          @RequestParam Boolean stream,
          @RequestParam String query){

    Endpoint embeddingEndpoint =
        new Endpoint(
            OPENAI_EMBEDDINGS_API,
            OPENAI_AUTH_KEY,
            "text-embedding-ada-002",
            new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

    Endpoint chatEndpoint =
        new Endpoint(
            OPENAI_CHAT_COMPLETION_API,
            OPENAI_AUTH_KEY,
            "gpt-3.5-turbo",
            "user",
            0.6,
            stream,
            new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

    if(chatEndpoint.getStream().equals(Boolean.FALSE)){
      RetrievalChain retrievalChain =
              new RedisRetrievalChain(
                      embeddingEndpoint,
                      chatEndpoint,
                      embeddingService,
                      redisService,
                      promptService,
                      openAiService);

      return retrievalChain.query(contextId, contextService,query,topK);
    }

    else {
      RetrievalEventStreamChain retrievalEventStreamChain =
              new RedisRetrievalEventStreamChain(
                      embeddingEndpoint, chatEndpoint, embeddingService, redisService, promptService);
      return retrievalEventStreamChain.query(openAiStreamService, contextId, contextService, query,topK);
    }

  }

  @PostMapping("/query/context/file/{contextId}")
  public Single<ChainResponse> queryContextFile(
      @PathVariable String contextId, @RequestBody HashMap<String, String> mapper) {

    Endpoint embeddingEndpoint =
        new Endpoint(
            OPENAI_EMBEDDINGS_API,
            OPENAI_AUTH_KEY,
            "text-embedding-ada-002",
            new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

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
        new RedisRetrievalChain(
            embeddingEndpoint,
            chatEndpoint,
            embeddingService,
            redisService,
            promptService,
            openAiService);

    return retrievalChain.query(
        contextId,
        contextService,
        new LocalFileResourceHandler(mapper.get("folder"), mapper.get("filename")));
  }
}
