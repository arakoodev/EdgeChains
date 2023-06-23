package com.edgechain.app.chains.retrieval;

import com.edgechain.app.services.EmbeddingService;
import com.edgechain.app.services.OpenAiService;
import com.edgechain.app.services.PromptService;
import com.edgechain.app.services.index.PineconeService;
import com.edgechain.lib.context.domain.HistoryContext;
import com.edgechain.lib.context.services.HistoryContextService;
import com.edgechain.lib.openai.endpoint.Endpoint;
import com.edgechain.lib.request.Doc2VecEmbeddingsRequest;
import com.edgechain.lib.request.OpenAiChatRequest;
import com.edgechain.lib.request.OpenAiEmbeddingsRequest;
import com.edgechain.lib.request.PineconeRequest;
import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import io.reactivex.rxjava3.core.Observable;
import java.util.ArrayList;
import java.util.List;
import java.util.StringTokenizer;

import io.reactivex.rxjava3.core.Single;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.web.WebProperties;
import reactor.adapter.rxjava.RxJava3Adapter;
import reactor.core.publisher.Mono;

public class PineconeRetrievalChain extends RetrievalChain {

  private final Logger logger = LoggerFactory.getLogger(getClass());

  private Endpoint embeddingEndpoint;

  private final Endpoint indexEndpoint;
  private Endpoint chatEndpoint;
  private final EmbeddingService embeddingService;
  private OpenAiService openAiService;
  private PromptService promptService;
  private final PineconeService pineconeService;

  // OpenAI (Upsert)
  public PineconeRetrievalChain(
      Endpoint embeddingEndpoint,
      Endpoint indexEndpoint,
      EmbeddingService embeddingService,
      PineconeService pineconeService) {
    this.embeddingEndpoint = embeddingEndpoint;
    this.indexEndpoint = indexEndpoint;
    this.embeddingService = embeddingService;
    this.pineconeService = pineconeService;
    logger.info("Using OpenAI Embedding Provider");
  }

  public PineconeRetrievalChain(
      Endpoint embeddingEndpoint,
      Endpoint indexEndpoint,
      Endpoint chatEndpoint,
      EmbeddingService embeddingService,
      PineconeService pineconeService,
      PromptService promptService,
      OpenAiService openAiService) {
    this.embeddingEndpoint = embeddingEndpoint;
    this.indexEndpoint = indexEndpoint;
    this.chatEndpoint = chatEndpoint;
    this.embeddingService = embeddingService;
    this.openAiService = openAiService;
    this.promptService = promptService;
    this.pineconeService = pineconeService;
    logger.info("Using OpenAI Embedding Provider");
  }

  // For Doc2Vec
  public PineconeRetrievalChain(
      Endpoint indexEndpoint, EmbeddingService embeddingService, PineconeService pineconeService) {
    this.indexEndpoint = indexEndpoint;
    this.embeddingService = embeddingService;
    this.pineconeService = pineconeService;
    logger.info("Using Doc2Vec Embedding Provider");
  }

  public PineconeRetrievalChain(
      Endpoint indexEndpoint,
      Endpoint chatEndpoint,
      EmbeddingService embeddingService,
      PineconeService pineconeService,
      PromptService promptService,
      OpenAiService openAiService) {
    this.indexEndpoint = indexEndpoint;
    this.chatEndpoint = chatEndpoint;
    this.embeddingService = embeddingService;
    this.pineconeService = pineconeService;
    this.promptService = promptService;
    this.openAiService = openAiService;
    logger.info("Using Doc2Vec Embedding Provider");
  }

  @Override
  public void upsert(String input) {

    this.embeddingOutput(input)
        .transform(
            embeddingOutput ->
                this.pineconeService
                    .upsert(new PineconeRequest(this.indexEndpoint, embeddingOutput))
                    .getResponse())
        .awaitWithoutRetry();
  }

  @Override
  public Observable<List<ChainResponse>> query(String queryText, int topK) {
    return this.embeddingOutput(queryText)
        .transform(
            embeddingOutput -> {
              String promptResponse = this.promptService.getIndexQueryPrompt().getResponse();

              List<ChainResponse> chainResponseList = new ArrayList<>();

              StringTokenizer tokenizer =
                  new StringTokenizer(
                      this.pineconeService
                          .query(new PineconeRequest(this.indexEndpoint, embeddingOutput, topK))
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
  public Observable<ChainResponse>query(
      String contextId, HistoryContextService contextService, String queryText, int topK) {

    return this.embeddingOutput(queryText)
        .transform(
            embeddingOutput ->
                this.queryWithChatHistory(embeddingOutput, contextId, contextService, queryText, topK)).getScheduledObservableWithoutRetry();
  }

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
      String queryText, int topK) {

    // Get the Prompt & The Context History
    String promptResponse = this.promptService.getIndexQueryPrompt().getResponse();
    HistoryContext historyContext = contextService.get(contextId).toSingleWithRetry().blockingGet();

    String chatHistory = historyContext.getResponse();
    String modifiedHistory;

    String indexResponse =
        this.pineconeService
            .query(new PineconeRequest(this.indexEndpoint, embeddingOutput, topK))
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
