package com.edgechain.app.controllers.wiki;

import com.edgechain.app.chains.WikiChain;
import com.edgechain.app.constants.WebConstants;
import com.edgechain.app.services.PluginService;
import com.edgechain.app.services.PromptService;
import com.edgechain.app.services.streams.OpenAiStreamService;
import com.edgechain.lib.openai.endpoint.Endpoint;
import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.lib.rxjava.retry.impl.ExponentialDelay;
import io.reactivex.rxjava3.core.Observable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;

import java.util.concurrent.TimeUnit;

import static com.edgechain.app.constants.WebConstants.OPENAI_CHAT_COMPLETION_API;

@RestController
@RequestMapping("/v1/sse/wiki")
public class WikiStreamController {

  @Autowired private PluginService pluginService;
  @Autowired private PromptService promptService;
  @Autowired private OpenAiStreamService openAiStreamService;

  @GetMapping(
      value = "/summary",
      produces = {MediaType.TEXT_EVENT_STREAM_VALUE})
  public Observable<ChainResponse> wikiSummaryStream(@RequestParam("query") String query) {

    System.out.println("Wiki Stream....");

    Endpoint chatEndpoint =
        new Endpoint(
            OPENAI_CHAT_COMPLETION_API,
            WebConstants.OPENAI_AUTH_KEY,
            "gpt-3.5-turbo",
            "user",
            0.4,
            true,
            new ExponentialDelay(2, 3, 2, TimeUnit.SECONDS));

    WikiChain wikiChain =
        new WikiChain(chatEndpoint, pluginService, promptService, openAiStreamService);
    return wikiChain.getWikiSummaryStream(query);
  }
}
