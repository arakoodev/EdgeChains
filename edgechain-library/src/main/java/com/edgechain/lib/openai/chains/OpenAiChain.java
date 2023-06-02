package com.edgechain.lib.openai.chains;

import com.edgechain.lib.openai.endpoint.Endpoint;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import io.reactivex.rxjava3.core.Observable;

public class OpenAiChain extends EdgeChain<String> {

    public OpenAiChain(Observable<String> observable) {
        super(observable);
    }

    public OpenAiChain(Observable<String> observable, Endpoint endpoint) {
        super(observable, endpoint);
    }
}
