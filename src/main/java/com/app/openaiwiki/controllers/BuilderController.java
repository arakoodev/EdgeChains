package com.app.openaiwiki.controllers;

import com.app.openaiwiki.services.BuilderService;
import com.app.rxjava.responses.ArkResponse;
import io.reactivex.rxjava3.core.Completable;
import io.reactivex.rxjava3.core.Observable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import reactor.core.publisher.Flux;

import java.util.HashMap;

@RestController
@RequestMapping("/builder")
public class BuilderController {

    @Autowired private BuilderService builderService;

    @GetMapping(value = "/openai-wiki", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<? extends ResponseEntity<?>> createChatCompletionFlux(@RequestParam("query") String query) {
        return ArkResponse
                .fromObservable(builderService.createChatCompletion(query).getScheduledObservable(), MediaType.TEXT_EVENT_STREAM).getResponse();
    }

    /**
     * Observable<?> is a perfect way to handle Responses unlike Flux (always prefer it);
     * Because it will lead to correct diagnosis if error emits.
     * Wrapping Observables to Flux aren't recommended (although you can create an Entity & wrap in it)....</?>
     * @return
     */
    @GetMapping(value = "/rx-openai", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Observable<String> createChatCompletionRx(@RequestParam("query") String query) {
        return builderService.createChatCompletion(query).getScheduledObservable();
    }

    @PostMapping(value = "/embeddings")
    public Flux<? extends ResponseEntity<?>> extractInformationFlux(@RequestPart("file") MultipartFile file,
                                                          @RequestPart("query") String query) {
        return ArkResponse
                .fromObservable(builderService.extractInformation(file,query).getScheduledObservable(),
                        MediaType.APPLICATION_JSON).getResponse();

    }

    @PostMapping(value = "/rx-embeddings")
    public Observable<String> extractInformationRx(@RequestPart("file") MultipartFile file,
                                                          @RequestPart("query") String query) {
        return builderService.extractInformation(file,query).getScheduledObservable();
    }


}
