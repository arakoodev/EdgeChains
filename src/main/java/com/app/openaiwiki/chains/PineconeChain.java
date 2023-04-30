package com.app.openaiwiki.chains;

import com.app.rxjava.endpoint.Endpoint;
import com.app.rxjava.transformer.observable.Transformer;
import io.reactivex.rxjava3.core.Observable;

public class PineconeChain extends Transformer<String> {
    public PineconeChain(Observable<String> observable) {
        super(observable);
    }

    public PineconeChain(Observable<String> observable, Endpoint endpoint) {
        super(observable, endpoint);
    }
}
