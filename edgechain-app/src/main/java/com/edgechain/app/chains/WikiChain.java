package com.edgechain.app.chains;

import com.edgechain.app.services.OpenAiService;
import com.edgechain.app.services.PluginService;
import com.edgechain.app.services.PromptService;
import com.edgechain.app.services.streams.OpenAiStreamService;
import com.edgechain.lib.openai.endpoint.Endpoint;
import com.edgechain.lib.request.OpenAiChatRequest;
import com.edgechain.lib.rxjava.response.ChainResponse;
import io.reactivex.rxjava3.core.Observable;
import io.reactivex.rxjava3.core.Single;
import io.reactivex.rxjava3.schedulers.Schedulers;
import reactor.core.publisher.Flux;

public class WikiChain {

  private static final int MAX_TOKENS = 4097;

  private final Endpoint endpoint;
  private final PluginService pluginService;
  private final PromptService promptService;

  private OpenAiStreamService openAiSteamService;
  private OpenAiService openAiService;

  public WikiChain(
      Endpoint endpoint,
      PluginService pluginService,
      PromptService promptService,
      OpenAiStreamService openAiSteamService) {
    this.endpoint = endpoint;
    this.pluginService = pluginService;
    this.promptService = promptService;
    this.openAiSteamService = openAiSteamService;
  }

  public WikiChain(
      Endpoint endpoint,
      PluginService pluginService,
      PromptService promptService,
      OpenAiService openAiService) {
    this.endpoint = endpoint;
    this.pluginService = pluginService;
    this.promptService = promptService;
    this.openAiService = openAiService;
  }

  public Observable<ChainResponse> getWikiSummaryStream(String searchText) {
    String input = this.createWikiSummaryPrompt(searchText);
    return openAiSteamService
        .chatCompletionStream(new OpenAiChatRequest(endpoint, input))
        .subscribeOn(Schedulers.io());
  }

  public Single<ChainResponse> getWikiSummary(String searchText) {
    return Single.just(
        openAiService.chatCompletion(
            new OpenAiChatRequest(endpoint, this.createWikiSummaryPrompt(searchText))));
  }

  private String createWikiSummaryPrompt(String searchText) {
    String input =
        promptService.getWikiSummaryPrompt().getResponse()
            + "\n"
            + pluginService.wikiContent(searchText).getResponse();
    input = input.length() > MAX_TOKENS ? input.substring(0, MAX_TOKENS) : input;
    return input;
  }
}
