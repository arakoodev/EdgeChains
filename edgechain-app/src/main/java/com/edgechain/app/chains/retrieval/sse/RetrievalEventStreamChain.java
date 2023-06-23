package com.edgechain.app.chains.retrieval.sse;

import com.edgechain.app.services.OpenAiService;
import com.edgechain.app.services.streams.OpenAiStreamService;
import com.edgechain.lib.context.services.HistoryContextService;
import com.edgechain.lib.rxjava.response.ChainResponse;

import io.reactivex.rxjava3.core.Observable;

public abstract class RetrievalEventStreamChain {

  public abstract Observable<?> query(OpenAiService openAiService, String queryText, int topK);

  public abstract Observable<ChainResponse> query(
      OpenAiStreamService openAiStreamService,
      String contextId,
      HistoryContextService contextService,
      String queryText,
      int topK);
}
