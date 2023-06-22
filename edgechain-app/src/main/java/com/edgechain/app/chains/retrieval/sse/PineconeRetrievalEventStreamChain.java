package com.edgechain.app.chains.retrieval.sse;

import com.edgechain.app.constants.WebConstants;
import com.edgechain.app.services.EmbeddingService;
import com.edgechain.app.services.OpenAiService;
import com.edgechain.app.services.PromptService;
import com.edgechain.app.services.index.PineconeService;
import com.edgechain.app.services.streams.OpenAiStreamService;
import com.edgechain.lib.context.domain.HistoryContext;
import com.edgechain.lib.context.services.HistoryContextService;
import com.edgechain.lib.openai.endpoint.Endpoint;
import com.edgechain.lib.request.Doc2VecEmbeddingsRequest;
import com.edgechain.lib.request.OpenAiChatRequest;
import com.edgechain.lib.request.OpenAiEmbeddingsRequest;
import com.edgechain.lib.request.PineconeRequest;
import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import com.edgechain.lib.rxjava.utils.AtomInteger;
import io.reactivex.rxjava3.core.Observable;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class PineconeRetrievalEventStreamChain extends RetrievalEventStreamChain {

  private final Logger logger = LoggerFactory.getLogger(getClass());

  private Endpoint embeddingEndpoint;

  private final Endpoint indexEndpoint;
  private Endpoint chatEndpoint;
  private final EmbeddingService embeddingService;
  private PromptService promptService;
  private final PineconeService pineconeService;

  // OpenAI (Upsert)
  public PineconeRetrievalEventStreamChain(
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

  public PineconeRetrievalEventStreamChain(
      Endpoint embeddingEndpoint,
      Endpoint indexEndpoint,
      Endpoint chatEndpoint,
      EmbeddingService embeddingService,
      PineconeService pineconeService,
      PromptService promptService) {
    this.embeddingEndpoint = embeddingEndpoint;
    this.indexEndpoint = indexEndpoint;
    this.chatEndpoint = chatEndpoint;
    this.embeddingService = embeddingService;
    this.promptService = promptService;
    this.pineconeService = pineconeService;
    logger.info("Using OpenAI Embedding Provider");
  }

  // For Doc2Vec
  public PineconeRetrievalEventStreamChain(
      Endpoint indexEndpoint, EmbeddingService embeddingService, PineconeService pineconeService) {
    this.indexEndpoint = indexEndpoint;
    this.embeddingService = embeddingService;
    this.pineconeService = pineconeService;
    logger.info("Using Doc2Vec Embedding Provider");
  }

  public PineconeRetrievalEventStreamChain(
      Endpoint indexEndpoint,
      Endpoint chatEndpoint,
      EmbeddingService embeddingService,
      PineconeService pineconeService,
      PromptService promptService) {
    this.indexEndpoint = indexEndpoint;
    this.chatEndpoint = chatEndpoint;
    this.embeddingService = embeddingService;
    this.pineconeService = pineconeService;
    this.promptService = promptService;
    logger.info("Using Doc2Vec Embedding Provider");
  }

  @Override
  public Observable<?> query(OpenAiService openAiService, String queryText, int topK) {

    String promptResponse = this.promptService.getIndexQueryPrompt().getResponse();
    String pineconeQuery =
        this.pineconeService
            .query(new PineconeRequest(this.indexEndpoint, this.embeddingOutput(queryText), topK))
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
        this.pineconeService
            .query(new PineconeRequest(this.indexEndpoint, this.embeddingOutput(queryText), 1))
            .getResponse();

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
