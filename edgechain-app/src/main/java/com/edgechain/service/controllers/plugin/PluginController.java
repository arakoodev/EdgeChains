package com.edgechain.service.controllers.plugin;

import com.edgechain.lib.openai.plugin.providers.PluginAPIProvider;
import com.edgechain.lib.openai.providers.OpenAiCompletionProvider;
import com.edgechain.lib.request.PluginAPIRequest;
import com.edgechain.lib.rxjava.provider.ChainProvider;
import com.edgechain.lib.rxjava.request.ChainRequest;
import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.lib.rxjava.wrapper.ChainWrapper;
import com.edgechain.lib.wiki.provider.WikiProvider;
import io.reactivex.rxjava3.core.Observable;
import io.reactivex.rxjava3.core.Single;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import reactor.adapter.rxjava.RxJava3Adapter;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/v1/plugins")
public class PluginController {

  @GetMapping(
      value = "/wiki",
      consumes = {MediaType.APPLICATION_JSON_VALUE},
      produces = {MediaType.APPLICATION_JSON_VALUE})
  public Single<ChainResponse> wikiContent(@RequestParam("query") String query) {
    WikiProvider wikiProvider = new WikiProvider();
    ChainWrapper wrapper = new ChainWrapper();
    return wrapper.chains(new ChainRequest(query), wikiProvider).toSingleWithRetry();
  }

  @PostMapping("/with-api")
  public Single<ChainResponse> getAPI(@RequestBody PluginAPIRequest request) {
    OpenAiCompletionProvider provider = new OpenAiCompletionProvider(request.getEndpoint());
    ChainProvider chainProvider =
        new PluginAPIProvider(provider, request.getPluginEndpoint(), request.getSpecEndpoint());
    ChainWrapper wrapper = new ChainWrapper();
    return wrapper.chains(new ChainRequest(request.getInput()), chainProvider).toSingleWithRetry();
  }
}
