package com.edgechain.app.controllers;

import com.edgechain.app.prompts.IndexQueryPrompt;
import com.edgechain.app.prompts.WikiSummaryPrompt;
import com.edgechain.lib.rxjava.response.ChainResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/v1/prompt")
public class PromptController {


    @GetMapping("/wiki-summary")
    public Mono<ChainResponse> getWikiSummaryPrompt() {
        return Mono.just(new ChainResponse(new WikiSummaryPrompt().getPrompt()));
    }

    @GetMapping("/index-query")
    public Mono<ChainResponse> getIndexQueryPrompt() {
        return Mono.just(new ChainResponse(new IndexQueryPrompt().getPrompt()));
    }
}