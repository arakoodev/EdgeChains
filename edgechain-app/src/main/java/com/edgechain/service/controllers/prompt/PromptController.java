package com.edgechain.service.controllers.prompt;

import com.edgechain.service.prompts.CustomPrompt;
import com.edgechain.service.prompts.IndexQueryPrompt;
import com.edgechain.service.prompts.RapPrompt;
import com.edgechain.service.prompts.WikiSummaryPrompt;
import com.edgechain.lib.rxjava.response.ChainResponse;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

import com.edgechain.app.constants.WebConstants;

@RestController
@RequestMapping("/v1/prompt")
public class PromptController {

  @GetMapping("/wiki-summary")
  public Mono<ChainResponse> getWikiSummaryPrompt() {
    return Mono.just(new ChainResponse(new WikiSummaryPrompt().getPrompt()));
  }

  @GetMapping("/rap-query")
  public Mono<ChainResponse> getRapQueryPrompt() {
    return Mono.just(new ChainResponse(new RapPrompt().getPrompt()));
  }

  @GetMapping("/custom-query")
  public Mono<ChainResponse> getCustomQueryPrompt(String jsonnetLocation, Map<String, String> extVarSettings) {
    return Mono
        .just(new ChainResponse(new CustomPrompt(jsonnetLocation).addExtVarSettings(extVarSettings).getPrompt()));
  }

  @GetMapping("/index-query")
  public Mono<ChainResponse> getIndexQueryPrompt() {
    return Mono.just(new ChainResponse(new IndexQueryPrompt().getPrompt()));
  }
}
