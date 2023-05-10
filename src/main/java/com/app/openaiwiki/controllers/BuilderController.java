package com.app.openaiwiki.controllers;

import com.app.openaiwiki.services.BuilderService;
import com.app.rxjava.responses.ArkResponse;
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
public class
BuilderController {

    @Autowired private BuilderService builderService;

    @GetMapping(value = "/openai-wiki", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<? extends ResponseEntity<?>> createChatCompletionFlux(@RequestParam("query") String query) {
        return ArkResponse
                .fromObservable(builderService.openAIWithWiki(query).getScheduledObservableWithoutRetry(),
                        MediaType.TEXT_EVENT_STREAM).getResponse();
    }

    @GetMapping(value = "/rx-openai", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Observable<String> createChatCompletionRx(@RequestParam("query") String query) {
        return builderService.openAIWithWiki(query).getScheduledObservableWithoutRetry();
    }



}
