package com.edgechain.lib.openai.plugin.providers;

import com.edgechain.lib.openai.plugin.builder.PluginBuilder;
import com.edgechain.lib.openai.plugin.parser.PluginJSONParser;
import com.edgechain.lib.openai.prompt.PromptTemplate;
import com.edgechain.lib.openai.providers.OpenAiCompletionProvider;
import com.edgechain.lib.rxjava.provider.ChainProvider;
import com.edgechain.lib.rxjava.request.ChainRequest;
import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;

import java.util.Objects;

public class PluginJSONProvider extends ChainProvider {

    private final OpenAiCompletionProvider provider;
    private final PluginJSONParser parser;
    private PromptTemplate promptTemplate;

    public PluginJSONProvider(OpenAiCompletionProvider provider, PluginJSONParser parser) {
        this.provider = provider;
        this.parser = parser;
    }

    public PluginJSONProvider(OpenAiCompletionProvider provider, PluginJSONParser parser, PromptTemplate promptTemplate) {
        this.provider = provider;
        this.parser = parser;
        this.promptTemplate = promptTemplate;
    }


    @Override
    public EdgeChain<ChainResponse> request(ChainRequest request) {

        if(Objects.isNull(promptTemplate)) {
            return PluginBuilder.requestJSON(provider,parser,request.getInput()).transform(ChainResponse::new);
        }

        return PluginBuilder.requestJSON(provider,parser,promptTemplate,request.getInput()).transform(ChainResponse::new);
    }
}
