package com.edgechain.app.chains.retrieval;

import com.edgechain.app.services.EmbeddingService;
import com.edgechain.app.services.OpenAiService;
import com.edgechain.app.services.PromptService;
import com.edgechain.app.services.index.RedisService;
import com.edgechain.lib.context.domain.HistoryContext;
import com.edgechain.lib.context.services.HistoryContextService;
import com.edgechain.lib.openai.endpoint.Endpoint;
import com.edgechain.lib.request.*;
import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import io.reactivex.rxjava3.core.Observable;
import java.util.ArrayList;
import java.util.List;
import java.util.StringTokenizer;

import io.reactivex.rxjava3.core.Single;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import reactor.adapter.rxjava.RxJava3Adapter;
import reactor.core.publisher.Mono;

public class RedisRetrievalChain extends RetrievalChain {

  private final Logger logger = LoggerFactory.getLogger(getClass());

  private Endpoint embeddingEndpoint;
  private Endpoint chatEndpoint;
  private final EmbeddingService embeddingService;
  private final RedisService redisService;
  private PromptService promptService;
  private OpenAiService openAiService;

  // For OpenAI
  public RedisRetrievalChain(
      Endpoint embeddingEndpoint, EmbeddingService embeddingService, RedisService redisService) {
    this.embeddingEndpoint = embeddingEndpoint;
    this.embeddingService = embeddingService;
    this.redisService = redisService;
    logger.info("Using OpenAI Embedding Provider");
  }

  public RedisRetrievalChain(
      Endpoint embeddingEndpoint,
      Endpoint chatEndpoint,
      EmbeddingService embeddingService,
      RedisService redisService,
      PromptService promptService,
      OpenAiService openAiService) {
    this.embeddingEndpoint = embeddingEndpoint;
    this.chatEndpoint = chatEndpoint;
    this.embeddingService = embeddingService;
    this.redisService = redisService;
    this.promptService = promptService;
    this.openAiService = openAiService;
    logger.info("Using OpenAI Embedding Provider");
  }

  // For Doc2Vec
  public RedisRetrievalChain(EmbeddingService embeddingService, RedisService redisService) {
    this.embeddingService = embeddingService;
    this.redisService = redisService;
    logger.info("Using Doc2Vec Embedding Provider");
  }

  public RedisRetrievalChain(
      Endpoint chatEndpoint,
      EmbeddingService embeddingService,
      RedisService redisService,
      PromptService promptService,
      OpenAiService openAiService) {
    this.chatEndpoint = chatEndpoint;
    this.embeddingService = embeddingService;
    this.redisService = redisService;
    this.promptService = promptService;
    this.openAiService = openAiService;
    logger.info("Using Doc2Vec Embedding Provider");
  }

  @Override
  public void upsert(String input) {

    this.embeddingOutput(input)
        .transform(
            embeddingOutput ->
                this.redisService.upsert(new RedisRequest(embeddingOutput)).getResponse())
        .awaitWithoutRetry();
  }

  @Override
  public Observable<List<ChainResponse>> query(String queryText, int topK) {
    return this.embeddingOutput(queryText)
        .transform(
            embeddingOutput -> {
              List<ChainResponse> chainResponseList = new ArrayList<>();

              String promptResponse = this.promptService.getIndexQueryPrompt().getResponse();

              StringTokenizer tokenizer =
                  new StringTokenizer(
                      this.redisService
                          .query(new RedisRequest(embeddingOutput, topK))
                          .getResponse(),
                      "\n");
              while (tokenizer.hasMoreTokens()) {

                String input = promptResponse + "\n" + tokenizer.nextToken();
                chainResponseList.add(
                    this.openAiService.chatCompletion(
                        new OpenAiChatRequest(this.chatEndpoint, input)));
              }

              return chainResponseList;
            }).getScheduledObservableWithoutRetry();
  }

  @Override
  public Observable<ChainResponse> query(
      String contextId, HistoryContextService contextService, String queryText, int topK) {
    return this.embeddingOutput(queryText)
        .transform(
            embeddingOutput ->
                this.queryWithChatHistory(embeddingOutput, contextId, contextService, queryText, topK))
        .getScheduledObservableWithoutRetry();
  }

  /*
  The RetrievalChain code is duplicated; shall be abstracted.
   */
  private EdgeChain<String> embeddingOutput(String input) {

    EdgeChain<String> edgeChain;

    if (embeddingEndpoint != null) {
      edgeChain =
          new EdgeChain<>(
              Observable.just(
                  this.embeddingService
                      .openAi(new OpenAiEmbeddingsRequest(this.embeddingEndpoint, input))
                      .getResponse()));
    } else {
      edgeChain =
          new EdgeChain<>(
              Observable.just(
                  this.embeddingService
                      .doc2Vec(new Doc2VecEmbeddingsRequest(input))
                      .getResponse()));
    }

    return edgeChain;
  }

  private ChainResponse queryWithChatHistory(
          String embeddingOutput,
          String contextId,
          HistoryContextService contextService,
          String queryText,
          int topK) {

    // Get the Prompt & The Context History
    String promptResponse = this.promptService.getIndexQueryPrompt().getResponse();
    HistoryContext historyContext = contextService.get(contextId).toSingleWithRetry().blockingGet();

    String chatHistory = historyContext.getResponse();
    String modifiedHistory;

    String indexResponse =
            this.redisService
                    .query(new RedisRequest(embeddingOutput, topK))
                    .getResponse();

    System.out.printf("Query-%s: %s\n", topK, indexResponse);

    int totalTokens =
            promptResponse.length()
                    + chatHistory.length()
                    + indexResponse.length()
                    + queryText.length();

    if (totalTokens > historyContext.getMaxTokens()) {
      int diff = Math.abs(historyContext.getMaxTokens() - totalTokens);
      System.out.println("Difference Value: "+diff);
      modifiedHistory = chatHistory.substring(diff + 1);
    }else {
      modifiedHistory = chatHistory;
    }

    // Then, Create Prompt For OpenAI
    String prompt;

    if (modifiedHistory.length() > 0) {
      prompt =
              "Question: "
                      + queryText
                      + "\n "
                      + promptResponse
                      + "\n"
                      + indexResponse
                      + "\nChat history:\n"
                      + modifiedHistory;
    } else {
      prompt = "Question: " + queryText + "\n " + promptResponse + "\n" + indexResponse;
    }

    System.out.println("Prompt: " + prompt);

    ChainResponse openAiResponse =
            this.openAiService.chatCompletion(new OpenAiChatRequest(this.chatEndpoint, prompt));

    String redisHistory = chatHistory + queryText + openAiResponse.getResponse();

    contextService.put(contextId, redisHistory).getWithRetry();

    return openAiResponse;
  }
}
