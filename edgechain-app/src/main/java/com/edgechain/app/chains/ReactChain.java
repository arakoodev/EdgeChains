package com.edgechain.app.chains;

import com.edgechain.app.constants.WebConstants;
import com.edgechain.app.services.OpenAiService;
import com.edgechain.app.services.PluginService;
import com.edgechain.app.services.PromptService;
import com.edgechain.app.services.ToolService;
import com.edgechain.lib.openai.endpoint.Endpoint;
import com.edgechain.lib.request.OpenAiChatRequest;
import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.lib.rxjava.utils.Atom;
import com.edgechain.service.prompts.runners.JsonnetRunner;

import io.reactivex.rxjava3.core.Observable;
import io.reactivex.rxjava3.schedulers.Schedulers;

import java.util.HashMap;
import java.util.Map;
import java.util.Objects;

import org.nd4j.shade.j2objc.annotations.Weak;

import me.xuender.unidecode.Unidecode;
import reactor.adapter.rxjava.RxJava3Adapter;
import reactor.core.publisher.Mono;

public class ReactChain {

  private final Endpoint endpoint;

  private final ToolService[] toolServices;

  public ReactChain(Endpoint endpoint, ToolService[] toolServices) {
    this.endpoint = endpoint;
    this.toolServices = toolServices;
  }

  public Mono<ChainResponse> getWikiSummary(String wikiQuery) {

    Atom<PromptService> promptService = Atom.of(null);
    Atom<PluginService> pluginService = Atom.of(null);
    Atom<OpenAiService> openService = Atom.of(null);

    for (ToolService toolService : toolServices) {

      if (toolService instanceof PromptService) {
        promptService.set((PromptService) toolService);
      }

      if (toolService instanceof PluginService) {
        pluginService.set((PluginService) toolService);
      }

      if (toolService instanceof OpenAiService) {
        openService.set((OpenAiService) toolService);
      }
    }

    if (Objects.isNull(promptService.get()))
      throw new RuntimeException("PromptService is not provided.");
    if (Objects.isNull(pluginService.get()))
      throw new RuntimeException("PluginService is not provided.");
    if (Objects.isNull(openService.get()))
      throw new RuntimeException("OpenService is not provided.");

    return RxJava3Adapter.singleToMono(
        Observable.just(pluginService.get().wikiContent(wikiQuery).getResponse())
            .map(wikiOutput -> Unidecode.decode(wikiOutput).replaceAll("[\t\n\r]+", " "))
            .map(
                wikiOutput -> promptService.get().getWikiSummaryPrompt().getResponse() + "\n" + wikiOutput)
            .map(
                wikiOutput -> wikiOutput.length() >= 4097 ? wikiOutput.substring(0, 4097) : wikiOutput)
            .map(input -> openService.get().chatCompletion(new OpenAiChatRequest(endpoint, input)))
            .subscribeOn(Schedulers.io())
            .firstOrError());
  }

  public Mono<ChainResponse> getRap(String rapQuery) {

    Atom<PromptService> promptService = Atom.of(null);
    Atom<PluginService> pluginService = Atom.of(null);
    Atom<OpenAiService> openService = Atom.of(null);

    for (ToolService toolService : toolServices) {

      if (toolService instanceof PromptService) {
        promptService.set((PromptService) toolService);
      }

      if (toolService instanceof PluginService) {
        pluginService.set((PluginService) toolService);
      }

      if (toolService instanceof OpenAiService) {
        openService.set((OpenAiService) toolService);
      }
    }

    if (Objects.isNull(promptService.get()))
      throw new RuntimeException("PromptService is not provided.");
    if (Objects.isNull(pluginService.get()))
      throw new RuntimeException("PluginService is not provided.");
    if (Objects.isNull(openService.get()))
      throw new RuntimeException("OpenService is not provided.");

    return RxJava3Adapter.singleToMono(
        Observable.just(pluginService.get().wikiContent(rapQuery).getResponse())
            .map(rapOutput -> Unidecode.decode(rapOutput).replaceAll("[\t\n\r]+", " "))
            .map(
                rapOutput -> promptService.get().getRapQueryPrompt().getResponse() + "\n" + rapOutput)
            .map(
                rapOutput -> rapOutput.length() >= 4097 ? rapOutput.substring(0, 4097) : rapOutput)
            .map(input -> openService.get().chatCompletion(new OpenAiChatRequest(endpoint, input)))
            .subscribeOn(Schedulers.io())
            .firstOrError());
  }

  public Mono<ChainResponse> getCustomQuery(String customQuery, HashMap<String, String> extVarSettings) {

    // TODO: Convert it from Hardcoded string to user input later
    String jsonnetCodeLocation = WebConstants.JSONNET_LOCATION;
    String jsonnetPrompt = new JsonnetRunner()
        .executor(jsonnetCodeLocation, extVarSettings)
        .get("prompt").getAsString();
    Atom<PromptService> promptService = Atom.of(null);
    Atom<PluginService> pluginService = Atom.of(null);
    Atom<OpenAiService> openService = Atom.of(null);

    for (ToolService toolService : toolServices) {

      if (toolService instanceof PromptService) {
        promptService.set((PromptService) toolService);
      }

      if (toolService instanceof PluginService) {
        pluginService.set((PluginService) toolService);
      }

      if (toolService instanceof OpenAiService) {
        openService.set((OpenAiService) toolService);
      }
    }

    if (Objects.isNull(promptService.get()))
      throw new RuntimeException("PromptService is not provided.");
    if (Objects.isNull(pluginService.get()))
      throw new RuntimeException("PluginService is not provided.");
    if (Objects.isNull(openService.get()))
      throw new RuntimeException("OpenService is not provided.");

    return RxJava3Adapter.singleToMono(
        Observable.just(pluginService.get().wikiContent(jsonnetPrompt).getResponse())
            .map(customOutput -> Unidecode.decode(customOutput).replaceAll("[\t\n\r]+", " "))
            .map(
                customOutput -> {
                  Map<String, String> extVarMap = new HashMap<String, String>();
                  extVarMap.put("keepContext", "true"); // Must be in string, can be later specified in environment
                                                        // variables or web constants, or programmatically
                  extVarMap.put("capContext", "true"); // Must be in string, can be later specified in environment
                                                       // variables or web constants, or programmatically
                  extVarMap.put("contextLength", "4096"); // Must be in string, can be later specified in environment
                                                          // variables or web constants, or programmatically
                  return (promptService.get()
                      .getCustomQueryPrompt(extVarMap).getResponse() + "\n"
                      + customOutput);
                })
            // .map(
            // customOutput -> customOutput.length() >= 4097 ? customOutput.substring(0,
            // 4097) : customOutput)
            .map(input -> openService.get().chatCompletion(new OpenAiChatRequest(endpoint, input)))
            .subscribeOn(Schedulers.io())
            .firstOrError());
  }
}
