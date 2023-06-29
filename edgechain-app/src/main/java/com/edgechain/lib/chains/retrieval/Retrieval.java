package com.edgechain.lib.chains.retrieval;

import com.edgechain.lib.context.domain.HistoryContext;
import com.edgechain.lib.context.services.HistoryContextService;
import com.edgechain.lib.resource.ResourceHandler;
import com.edgechain.lib.rxjava.response.ChainResponse;


public abstract class Retrieval {

  public abstract void upsert(String input);

  public ChainResponse extract(
      String contextId, HistoryContextService contextService, ResourceHandler resourceHandler) {
    HistoryContext context = contextService.get(contextId).getWithRetry();
    resourceHandler.upload(context.getResponse());
    return new ChainResponse("File is successfully uploaded to the provided destination");
  }
}
