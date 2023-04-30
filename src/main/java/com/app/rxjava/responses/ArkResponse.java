package com.app.rxjava.responses;

import com.app.openaiwiki.exceptions.UserException;
import io.reactivex.rxjava3.core.BackpressureStrategy;
import io.reactivex.rxjava3.core.Observable;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import reactor.adapter.rxjava.RxJava3Adapter;
import reactor.core.publisher.Flux;

public class ArkResponse {

    private final Flux<? extends ResponseEntity<?>> response;

    private ArkResponse(Flux<? extends ResponseEntity<?>> response) {
        this.response = response;
    }
    
    public static ArkResponse fromObservable(Observable<?> observable, MediaType mediaType){

        Flux<? extends ResponseEntity<?>> responseFlux = RxJava3Adapter.observableToFlux(observable, BackpressureStrategy.BUFFER)
                .map(result -> ResponseEntity.ok().contentType(mediaType).body(result))
                .onErrorResume(e -> Flux.error(new UserException(e.getMessage())));

        return new ArkResponse(responseFlux);
    }

    public Flux<? extends ResponseEntity<?>> getResponse() {
        return response;
    }
}