package com.edgechain.lib.context.client;

import com.edgechain.lib.context.domain.HistoryContext;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;

public interface HistoryContextClient<T> {

  EdgeChain<HistoryContext> create(String id, T endpoint);

  EdgeChain<HistoryContext> put(String key, String response, T endpoint);

  EdgeChain<HistoryContext> get(String key, T endpoint);

  EdgeChain<String> delete(String key, T endpoint);
}
