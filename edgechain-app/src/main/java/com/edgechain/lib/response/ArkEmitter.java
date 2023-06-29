package com.edgechain.lib.response;

import io.reactivex.rxjava3.core.Observable;
import org.springframework.http.MediaType;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

public class ArkEmitter<T> extends SseEmitter {

    private final ArkEmitterObserver<T> observer;

    public ArkEmitter(Observable<T> observable) {
        this(null, observable);
    }

    public ArkEmitter(MediaType mediaType, Observable<T> observable) {
        this.observer = new ArkEmitterObserver<T>(mediaType, observable, this);
    }

}