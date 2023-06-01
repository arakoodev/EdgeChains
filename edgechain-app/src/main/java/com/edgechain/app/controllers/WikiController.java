package com.edgechain.app.controllers;

import com.edgechain.app.services.OpenAiService;
import com.edgechain.lib.openai.endpoint.Endpoint;
import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.lib.rxjava.retry.impl.ExponentialDelay;
import com.edgechain.app.chains.ReactChain;
import com.edgechain.app.constants.WebConstants;
import com.edgechain.app.services.PluginService;
import com.edgechain.app.services.PromptService;
import com.edgechain.app.services.ToolService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/v1/wiki")
public class WikiController {

  private static final String OPENAI_CHAT_COMPLETION_API =
      "https://api.openai.com/v1/chat/completions";
  @Autowired private PromptService promptService;
  @Autowired private PluginService pluginService;

  @Autowired private OpenAiService openAiService;

  @GetMapping("/summary")
  public Mono<ChainResponse> getSummary(@RequestParam("query") String query) {

    Endpoint chatEndpoint =
        new Endpoint(
            OPENAI_CHAT_COMPLETION_API,
            WebConstants.OPENAI_AUTH_KEY,
            "gpt-3.5-turbo",
            "user",
            0.4,
            new ExponentialDelay(2, 3, 2, TimeUnit.SECONDS));

    ToolService[] toolServices = {promptService, openAiService, pluginService};
    ReactChain reactChain = new ReactChain(chatEndpoint, toolServices);
    return reactChain.getWikiSummary(query);
  }
}
