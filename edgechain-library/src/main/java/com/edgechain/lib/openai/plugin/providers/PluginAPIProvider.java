package com.edgechain.lib.openai.plugin.providers;


import com.edgechain.lib.openai.endpoint.Endpoint;
import com.edgechain.lib.openai.plugin.builder.PluginBuilder;
import com.edgechain.lib.openai.prompt.PromptTemplate;
import com.edgechain.lib.openai.providers.OpenAiCompletionProvider;
import com.edgechain.lib.rxjava.provider.ChainProvider;
import com.edgechain.lib.rxjava.request.ChainRequest;
import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;

import java.util.Objects;

public class PluginAPIProvider extends ChainProvider {

    private final OpenAiCompletionProvider provider;
    private final Endpoint pluginAPI;
    private final Endpoint specAPI;
    private PromptTemplate promptTemplate;

    public PluginAPIProvider(OpenAiCompletionProvider provider, Endpoint pluginAPI, Endpoint specAPI) {
        this.provider = provider;
        this.pluginAPI = pluginAPI;
        this.specAPI = specAPI;
    }

    public PluginAPIProvider(OpenAiCompletionProvider provider, Endpoint pluginAPI, Endpoint specAPI, PromptTemplate promptTemplate) {
        this.provider = provider;
        this.pluginAPI = pluginAPI;
        this.specAPI = specAPI;
        this.promptTemplate = promptTemplate;
    }

    @Override
    public EdgeChain<ChainResponse> request(ChainRequest request) {

        if(Objects.isNull(promptTemplate)) {
            return PluginBuilder.requestAPI(provider,pluginAPI,specAPI,request.getInput()).transform(ChainResponse::new);
        }

        return PluginBuilder.requestAPI(provider,pluginAPI,specAPI,promptTemplate, request.getInput()).transform(ChainResponse::new);
    }
}
