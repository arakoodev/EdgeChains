package com.edgechain.service.controllers;

import com.edgechain.service.wiki.WikiProvider;
import com.edgechain.lib.openai.plugin.providers.PluginAPIProvider;
import com.edgechain.lib.openai.providers.OpenAiCompletionProvider;
import com.edgechain.lib.rxjava.provider.ChainProvider;
import com.edgechain.lib.rxjava.request.ChainRequest;
import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.lib.rxjava.wrapper.ChainWrapper;
import com.edgechain.service.request.PluginAPIRequest;
import org.springframework.web.bind.annotation.*;
import reactor.adapter.rxjava.RxJava3Adapter;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/v1/plugins")
public class PluginController {

  @GetMapping("/wiki")
  public Mono<ChainResponse> wikiContent(@RequestParam("query") String query) {
    WikiProvider wikiProvider = new WikiProvider();
    ChainWrapper wrapper = new ChainWrapper();
    return RxJava3Adapter.singleToMono(
        wrapper.chains(new ChainRequest(query), wikiProvider).toSingleWithRetry());
  }

  @PostMapping("/with-api")
  public Mono<ChainResponse> getAPI(@RequestBody PluginAPIRequest request) {
    OpenAiCompletionProvider provider = new OpenAiCompletionProvider(request.getEndpoint());
    ChainProvider chainProvider =
        new PluginAPIProvider(provider, request.getPluginEndpoint(), request.getSpecEndpoint());
    ChainWrapper wrapper = new ChainWrapper();
    return RxJava3Adapter.singleToMono(
        wrapper.chains(new ChainRequest(request.getInput()), chainProvider).toSingleWithRetry());
  }
}
