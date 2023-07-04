package com.edgechain.service.controllers.wiki;

import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import com.edgechain.lib.utils.RetryUtils;
import com.edgechain.lib.wiki.client.WikiClient;
import com.edgechain.lib.wiki.request.WikiRequest;
import com.edgechain.lib.wiki.response.WikiResponse;
import io.reactivex.rxjava3.core.Single;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

@RestController("Service WikiController")
@RequestMapping(value = "/v2/wiki")
public class WikiController {

  @PostMapping(
      value = "/page-content",
      consumes = {MediaType.APPLICATION_JSON_VALUE},
      produces = {MediaType.APPLICATION_JSON_VALUE})
  public Single<WikiResponse> wikiContent(@RequestBody WikiRequest request) {
    EdgeChain<WikiResponse> edgeChain =
        new WikiClient().getPageContent(new WikiRequest(request.getEndpoint(), request.getInput()));

    if (RetryUtils.available(request.getEndpoint()))
      return edgeChain.toSingle(request.getEndpoint().getRetryPolicy());
    else return edgeChain.toSingle();
  }
}
