package com.edgechain.lib.openai.chains;

import com.edgechain.lib.openai.endpoint.Endpoint;
import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import io.reactivex.rxjava3.core.Observable;

public class IndexChain extends EdgeChain<ChainResponse> {

    public IndexChain(Observable<ChainResponse> observable) {
        super(observable);
    }

    public IndexChain(Observable<ChainResponse> observable, Endpoint endpoint) {
        super(observable, endpoint);
    }
}
