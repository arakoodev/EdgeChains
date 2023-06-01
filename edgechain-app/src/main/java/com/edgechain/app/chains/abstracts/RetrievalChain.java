package com.edgechain.app.chains.abstracts;

import com.edgechain.app.services.abstracts.IndexService;
import com.edgechain.app.services.OpenAiService;
import com.edgechain.app.services.PromptService;
import com.edgechain.lib.openai.endpoint.Endpoint;
import com.edgechain.lib.rxjava.response.ChainResponse;
import reactor.core.publisher.Mono;

import java.util.List;

public abstract class RetrievalChain {

  private Endpoint embeddingEndpoint;
  private final Endpoint indexEndpoint;
  private Endpoint chatEndpoint;
  private OpenAiService openAiService;
  private PromptService promptService;
  private IndexService indexService;

  public RetrievalChain(
      Endpoint embeddingEndpoint,
      Endpoint indexEndpoint,
      OpenAiService openAiService,
      IndexService indexService) {
    this.embeddingEndpoint = embeddingEndpoint;
    this.indexEndpoint = indexEndpoint;
    this.openAiService = openAiService;
    this.indexService = indexService;
  }

  public RetrievalChain(
      Endpoint embeddingEndpoint,
      Endpoint indexEndpoint,
      Endpoint chatEndpoint,
      OpenAiService openAiService,
      PromptService promptService,
      IndexService indexService) {
    this.embeddingEndpoint = embeddingEndpoint;
    this.indexEndpoint = indexEndpoint;
    this.chatEndpoint = chatEndpoint;
    this.openAiService = openAiService;
    this.promptService = promptService;
    this.indexService = indexService;
  }

  public RetrievalChain(Endpoint indexEndpoint, IndexService indexService) {
    this.indexEndpoint = indexEndpoint;
    this.indexService = indexService;
  }

  public abstract void upsert(String input);

  public abstract Mono<List<ChainResponse>> query(String queryText, int topK);

  public abstract ChainResponse delete();

  public Endpoint getEmbeddingEndpoint() {
    return embeddingEndpoint;
  }

  public Endpoint getIndexEndpoint() {
    return indexEndpoint;
  }

  public Endpoint getChatEndpoint() {
    return chatEndpoint;
  }

  public OpenAiService getOpenAiService() {
    return openAiService;
  }

  public IndexService getIndexService() {
    return indexService;
  }

  public PromptService getPromptService() {
    return promptService;
  }
}
