package com.edgechain.app.chains.retrieval.sse;

import com.edgechain.app.constants.WebConstants;
import com.edgechain.app.services.EmbeddingService;
import com.edgechain.app.services.OpenAiService;
import com.edgechain.app.services.PromptService;
import com.edgechain.app.services.index.RedisService;
import com.edgechain.app.services.streams.OpenAiStreamService;
import com.edgechain.lib.context.domain.HistoryContext;
import com.edgechain.lib.context.services.HistoryContextService;
import com.edgechain.lib.openai.endpoint.Endpoint;
import com.edgechain.lib.request.*;
import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import com.edgechain.lib.rxjava.utils.AtomInteger;
import io.reactivex.rxjava3.core.Observable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class RedisRetrievalEventStreamChain extends RetrievalEventStreamChain {

  private final Logger logger = LoggerFactory.getLogger(getClass());

  private Endpoint embeddingEndpoint;
  private Endpoint chatEndpoint;
  private final EmbeddingService embeddingService;
  private final RedisService redisService;
  private PromptService promptService;

  // For OpenAI
  public RedisRetrievalEventStreamChain(
      Endpoint embeddingEndpoint, EmbeddingService embeddingService, RedisService redisService) {
    this.embeddingEndpoint = embeddingEndpoint;
    this.embeddingService = embeddingService;
    this.redisService = redisService;
    logger.info("Using OpenAI Embedding Provider");
  }

  public RedisRetrievalEventStreamChain(
      Endpoint embeddingEndpoint,
      Endpoint chatEndpoint,
      EmbeddingService embeddingService,
      RedisService redisService,
      PromptService promptService) {
    this.embeddingEndpoint = embeddingEndpoint;
    this.chatEndpoint = chatEndpoint;
    this.embeddingService = embeddingService;
    this.redisService = redisService;
    this.promptService = promptService;
    logger.info("Using OpenAI Embedding Provider");
  }

  // For Doc2Vec
  public RedisRetrievalEventStreamChain(
      EmbeddingService embeddingService, RedisService redisService) {
    this.embeddingService = embeddingService;
    this.redisService = redisService;
    logger.info("Using Doc2Vec Embedding Provider");
  }

  public RedisRetrievalEventStreamChain(
      Endpoint chatEndpoint,
      EmbeddingService embeddingService,
      RedisService redisService,
      PromptService promptService) {
    this.chatEndpoint = chatEndpoint;
    this.embeddingService = embeddingService;
    this.redisService = redisService;
    this.promptService = promptService;
    logger.info("Using Doc2Vec Embedding Provider");
  }

  @Override
  public Observable<?> query(OpenAiService openAiService, String queryText, int topK) {
    String promptResponse = this.promptService.getIndexQueryPrompt().getResponse();
    String pineconeQuery =
        this.redisService
            .query(new RedisRequest(this.embeddingOutput(queryText), topK))
            .getResponse();
    String[] tokens = pineconeQuery.split("\n");

    AtomInteger currentTopK = AtomInteger.of(0);
    return new EdgeChain<>(
            Observable.create(
                emitter -> {
                  try {
                    String input = promptResponse + "\n" + tokens[currentTopK.getAndIncrement()];

                    emitter.onNext(
                        openAiService.chatCompletion(
                            new OpenAiChatRequest(this.chatEndpoint, input)));
                    emitter.onComplete();
                  } catch (final Exception e) {
                    emitter.onError(e);
                  }
                }))
        .doWhileLoop(() -> currentTopK.get() == topK)
        .getScheduledObservableWithoutRetry();
  }

  @Override
  public Observable<ChainResponse> query(
      OpenAiStreamService openAiStreamService,
      String contextId,
      HistoryContextService contextService,
      String queryText) {
    // Get the Prompt & The Context History
    String promptResponse = this.promptService.getIndexQueryPrompt().getResponse();
    HistoryContext historyContext = contextService.get(contextId).toSingleWithRetry().blockingGet();

    String chatHistory = historyContext.getResponse();

    String indexResponse =
        this.redisService.query(new RedisRequest(this.embeddingOutput(queryText), 1)).getResponse();

    int totalTokens =
        promptResponse.length()
            + chatHistory.length()
            + indexResponse.length()
            + queryText.length();

    if (totalTokens > historyContext.getMaxTokens()) {
      int diff = historyContext.getMaxTokens() - totalTokens;
      chatHistory = chatHistory.substring(diff + 1);
    }

    // Then, Create Prompt For OpenAI
    String prompt;

    if (chatHistory.length() > 0) {
      prompt =
          "Question: "
              + queryText
              + "\n "
              + promptResponse
              + "\n"
              + indexResponse
              + "\nChat history:\n"
              + chatHistory;
    } else {
      prompt = "Question: " + queryText + "\n " + promptResponse + "\n" + indexResponse;
    }

    System.out.println("Prompt: " + prompt);

    StringBuilder openAiResponseBuilder = new StringBuilder();
    final String finalChatHistory = chatHistory;

    return openAiStreamService
        .chatCompletionStream(new OpenAiChatRequest(this.chatEndpoint, prompt))
        .doOnNext(
            v -> {
              if (v.getResponse().equals(WebConstants.CHAT_STREAM_EVENT_COMPLETION_MESSAGE)) {
                String redisHistory =
                    finalChatHistory
                        + queryText
                        + openAiResponseBuilder.toString().replaceAll("[\t\n\r]+", " ");
                System.out.println(redisHistory);
                contextService.put(contextId, redisHistory).getWithRetry();
              } else {
                openAiResponseBuilder.append(v.getResponse());
              }
            });
  }

  private String embeddingOutput(String input) {

    String embeddings;

    if (embeddingEndpoint != null) {
      embeddings =
          this.embeddingService
              .openAi(new OpenAiEmbeddingsRequest(this.embeddingEndpoint, input))
              .getResponse();
    } else {
      embeddings = this.embeddingService.doc2Vec(new Doc2VecEmbeddingsRequest(input)).getResponse();
    }

    return embeddings;
  }
}
