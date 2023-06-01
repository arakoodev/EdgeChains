package com.edgechain.app.chains;

import com.edgechain.lib.openai.endpoint.Endpoint;
import com.edgechain.app.request.OpenAiChatRequest;
import com.edgechain.app.services.OpenAiService;
import com.edgechain.app.services.PluginService;
import com.edgechain.app.services.PromptService;
import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.app.services.ToolService;
import com.edgechain.lib.rxjava.utils.Atom;
import io.reactivex.rxjava3.core.Observable;
import io.reactivex.rxjava3.schedulers.Schedulers;
import me.xuender.unidecode.Unidecode;
import reactor.adapter.rxjava.RxJava3Adapter;
import reactor.core.publisher.Mono;

import java.util.Objects;

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

        if (Objects.isNull(promptService.get())) throw new RuntimeException("PromptService is not provided.");
        if (Objects.isNull(pluginService.get())) throw new RuntimeException("PluginService is not provided.");
        if (Objects.isNull(openService.get())) throw new RuntimeException("OpenService is not provided.");

        return RxJava3Adapter.singleToMono(
                Observable.just(pluginService.get().wikiContent(wikiQuery).getResponse())
                        .map(wikiOutput -> Unidecode.decode(wikiOutput).replaceAll("[\t\n\r]+", " "))
                        .map(wikiOutput -> promptService.get().getWikiSummaryPrompt().getResponse() + "\n" +wikiOutput)
                        .map(wikiOutput -> wikiOutput.length() >= 4097 ? wikiOutput.substring(0, 4097): wikiOutput)
                        .map(input -> openService.get().chatCompletion(new OpenAiChatRequest(endpoint,input)))
                        .subscribeOn(Schedulers.io())
                        .firstOrError()
        );


    }

}
