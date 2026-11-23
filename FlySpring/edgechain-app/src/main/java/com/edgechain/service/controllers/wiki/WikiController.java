package com.edgechain.service.controllers.wiki;

import com.edgechain.lib.configuration.WebConfiguration;
import com.edgechain.lib.endpoint.impl.wiki.WikiEndpoint;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import com.edgechain.lib.wiki.client.WikiClient;
import com.edgechain.lib.wiki.response.WikiResponse;
import io.reactivex.rxjava3.core.Single;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

@RestController("Service WikiController")
@RequestMapping(value = WebConfiguration.CONTEXT_PATH + "/wiki")
public class WikiController {

  @PostMapping(
      value = "/page-content",
      consumes = {MediaType.APPLICATION_JSON_VALUE},
      produces = {MediaType.APPLICATION_JSON_VALUE})
  public Single<WikiResponse> wikiContent(@RequestBody WikiEndpoint wikiEndpoint) {
    EdgeChain<WikiResponse> edgeChain =
        new WikiClient(wikiEndpoint).getPageContent(wikiEndpoint.getInput());
    return edgeChain.toSingle();
  }
}
