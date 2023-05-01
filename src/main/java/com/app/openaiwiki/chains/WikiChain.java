package com.app.openaiwiki.chains;

import com.app.rxjava.endpoint.Endpoint;
import com.app.rxjava.transformer.observable.Transformer;
import io.reactivex.rxjava3.core.Observable;

public class WikiChain extends Transformer<String> {

    public WikiChain(Observable<String> observable) {
        super(observable);
    }

    public WikiChain(Observable<String> observable, Endpoint endpoint) {
        super(observable, endpoint);
    }
}
