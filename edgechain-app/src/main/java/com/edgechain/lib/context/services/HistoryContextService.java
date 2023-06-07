package com.edgechain.lib.context.services;

import com.edgechain.lib.context.domain.HistoryContext;
import com.edgechain.lib.context.domain.HistoryContextRequest;
import com.edgechain.lib.context.domain.HistoryContextResponse;
import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import org.json.JSONObject;

public interface HistoryContextService {

    EdgeChain<HistoryContextResponse> create(HistoryContextRequest contextRequest);
    EdgeChain<HistoryContext> put(String key, String response);
    EdgeChain<HistoryContext> get(String key);
    EdgeChain<ChainResponse> delete(String key);

}
