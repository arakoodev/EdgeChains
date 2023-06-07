package com.edgechain.app.chains.abstracts;

import com.edgechain.lib.context.services.HistoryContextService;
import com.edgechain.lib.resource.ResourceHandler;
import com.edgechain.lib.rxjava.response.ChainResponse;
import reactor.core.publisher.Mono;

import java.util.List;

public abstract class RetrievalChain {

  public abstract void upsert(String input);

  public abstract Mono<List<ChainResponse>> query(String queryText, int topK);

  public abstract Mono<ChainResponse> query(
      String contextId, HistoryContextService contextService, String queryText);

  public abstract Mono<ChainResponse> query(
      String contextId, HistoryContextService contextService, ResourceHandler resourceHandler);
}
