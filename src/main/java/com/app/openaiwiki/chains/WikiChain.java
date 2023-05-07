package com.app.openaiwiki.chains;

import com.app.openai.endpoint.Endpoint;
import com.app.rxjava.transformer.observable.EdgeChain;
import io.reactivex.rxjava3.core.Observable;

public class WikiChain extends EdgeChain<String> {

    public WikiChain(Observable<String> observable) {
        super(observable);
    }

    public WikiChain(Observable<String> observable, Endpoint endpoint) {
        super(observable, endpoint);
    }
}
