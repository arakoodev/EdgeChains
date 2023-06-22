package com.edgechain.service.controllers.prompt;

import com.edgechain.lib.openai.providers.PromptProvider;
import com.edgechain.lib.rxjava.provider.ChainProvider;
import com.edgechain.lib.rxjava.wrapper.ChainWrapper;
import com.edgechain.service.prompts.IndexQueryPrompt;
import com.edgechain.service.prompts.WikiSummaryPrompt;
import com.edgechain.lib.rxjava.response.ChainResponse;
import io.reactivex.rxjava3.core.Single;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/v1/prompt")
public class PromptController {

  @GetMapping("/wiki-summary")
  public Single<ChainResponse> getWikiSummaryPrompt() {
    return Single.just(new ChainResponse(new WikiSummaryPrompt().getPrompt()));
  }

  @GetMapping("/index-query")
  public Single<ChainResponse> getIndexQueryPrompt() {
    return Single.just(new ChainResponse(new IndexQueryPrompt().getPrompt()));
  }
}
