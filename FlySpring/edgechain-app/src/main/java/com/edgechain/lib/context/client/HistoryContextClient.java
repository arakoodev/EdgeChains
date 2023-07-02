package com.edgechain.lib.context.client;

import com.edgechain.lib.context.domain.HistoryContext;
import com.edgechain.lib.response.StringResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import io.reactivex.rxjava3.core.Completable;

public interface HistoryContextClient {

  EdgeChain<HistoryContext> create();

  EdgeChain<HistoryContext> put(String key, String response);

  EdgeChain<HistoryContext> get(String key);

  EdgeChain<Boolean> check(String key);

  Completable delete(String key);
}
