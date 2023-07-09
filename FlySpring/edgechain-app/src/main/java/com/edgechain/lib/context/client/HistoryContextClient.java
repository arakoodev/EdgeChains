package com.edgechain.lib.context.client;

import com.edgechain.lib.context.domain.HistoryContext;
import com.edgechain.lib.endpoint.Endpoint;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;

public interface HistoryContextClient {

  EdgeChain<HistoryContext> create(String id, Endpoint endpoint);

  EdgeChain<HistoryContext> put(String key, String response, Endpoint endpoint);

  EdgeChain<HistoryContext> get(String key, Endpoint endpoint);

  EdgeChain<Boolean> check(String key, Endpoint endpoint);

  EdgeChain<String> delete(String key, Endpoint endpoint);
}
