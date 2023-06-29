package com.edgechain.lib.response;

import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import io.reactivex.rxjava3.core.Observable;
import org.springframework.web.context.request.async.DeferredResult;

public class ArkResponse<T> extends DeferredResult<T> {

    private final ArkObserver<T> observer;

    public ArkResponse(Observable<T> observable) {
        observer = new ArkObserver<>(observable, this);
    }

}