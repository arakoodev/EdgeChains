package com.edgechain.lib.openai.chains;

import com.edgechain.lib.openai.endpoint.Endpoint;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import io.reactivex.rxjava3.core.Observable;

public class PluginChain extends EdgeChain<String> {


    public PluginChain(Observable<String> observable) {
        super(observable);
    }

    public PluginChain(Observable<String> observable, Endpoint endpoint) {
        super(observable, endpoint);
    }
}
