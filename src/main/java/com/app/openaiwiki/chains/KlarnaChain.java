package com.app.openaiwiki.chains;

import com.app.openaiwiki.response.AiPluginResponse;
import com.app.rxjava.endpoint.Endpoint;
import com.app.rxjava.transformer.observable.Transformer;
import io.reactivex.rxjava3.core.Observable;

public class KlarnaChain extends Transformer<AiPluginResponse> {


    public KlarnaChain(Observable<AiPluginResponse> observable) {
        super(observable);
    }

    public KlarnaChain(Observable<AiPluginResponse> observable, Endpoint endpoint) {
        super(observable, endpoint);
    }
}
