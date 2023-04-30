package com.app.openaiwiki.flow;

import com.app.rxjava.endpoint.EndpointFlow;
import com.app.rxjava.transformer.completable.CompletableTransformer;
import io.reactivex.rxjava3.core.Completable;

public class PineconeFlow extends CompletableTransformer {

    public PineconeFlow(Completable completable) {
        super(completable);
    }

    public PineconeFlow(Completable completable, EndpointFlow endpoint) {
        super(completable, endpoint);
    }
}
