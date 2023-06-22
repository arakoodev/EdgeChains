package com.edgechain.app.controllers.redis.sse;

import com.edgechain.app.chains.retrieval.sse.PineconeRetrievalEventStreamChain;
import com.edgechain.app.chains.retrieval.sse.RedisRetrievalEventStreamChain;
import com.edgechain.app.chains.retrieval.sse.RetrievalEventStreamChain;
import com.edgechain.app.services.EmbeddingService;
import com.edgechain.app.services.OpenAiService;
import com.edgechain.app.services.PromptService;
import com.edgechain.app.services.index.RedisService;
import com.edgechain.app.services.streams.OpenAiStreamService;
import com.edgechain.lib.context.services.impl.RedisHistoryContextService;
import com.edgechain.lib.openai.endpoint.Endpoint;
import com.edgechain.lib.rxjava.retry.impl.ExponentialDelay;
import io.reactivex.rxjava3.core.Observable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

import java.util.concurrent.TimeUnit;

import static com.edgechain.app.constants.WebConstants.*;
import static com.edgechain.app.constants.WebConstants.OPENAI_AUTH_KEY;

@RestController
@RequestMapping("/v1/sse/redis/openai")
public class RedisOpenAiEventStreamController {

  @Autowired private EmbeddingService embeddingService;
  @Autowired private RedisService redisService;
  @Autowired private PromptService promptService;
  @Autowired private OpenAiService openAiService;
  @Autowired private OpenAiStreamService openAiStreamService;
  @Autowired private RedisHistoryContextService contextService;

  @GetMapping(
      value = "/query/{topK}",
      produces = {MediaType.TEXT_EVENT_STREAM_VALUE})
  public Observable<?> query(
      @PathVariable("topK") Integer topK, @RequestParam("query") String query) {

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
            false,
            new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

    RetrievalEventStreamChain retrievalEventStreamChain =
        new RedisRetrievalEventStreamChain(
            embeddingEndpoint, chatEndpoint, embeddingService, redisService, promptService);

    return retrievalEventStreamChain.query(openAiService, query, topK);
  }

  @GetMapping(
      value = "/query/context/{contextId}",
      produces = {MediaType.TEXT_EVENT_STREAM_VALUE})
  public Observable<?> queryWithHistoryContext(
      @PathVariable("contextId") String contextId, @RequestParam("query") String query) {

    Endpoint embeddingEndpoint =
        new Endpoint(
            OPENAI_EMBEDDINGS_API,
            OPENAI_AUTH_KEY,
            "text-embedding-ada-002",
            new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

    Endpoint pineconeEndpoint =
        new Endpoint(
            PINECONE_QUERY_API, PINECONE_AUTH_KEY, new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

    Endpoint chatEndpoint =
        new Endpoint(
            OPENAI_CHAT_COMPLETION_API,
            OPENAI_AUTH_KEY,
            "gpt-3.5-turbo",
            "user",
            0.3,
            false,
            new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

    RetrievalEventStreamChain retrievalEventStreamChain =
        new RedisRetrievalEventStreamChain(
            embeddingEndpoint, chatEndpoint, embeddingService, redisService, promptService);
    return retrievalEventStreamChain.query(openAiStreamService, contextId, contextService, query);
  }
}
