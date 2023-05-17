package com.app.openai.plugin.template;

import com.app.openai.endpoint.Endpoint;
import com.app.openai.llm.provider.impl.OpenAiCompletionProvider;
import com.app.openai.llm.service.LLMService;
import com.app.openai.plugin.builder.PluginBuilder;
import com.app.openai.plugin.parser.PluginJSONParser;
import com.app.rxjava.retry.RetryPolicy;
import com.app.rxjava.transformer.observable.EdgeChain;

public class PluginTemplate {

  public static EdgeChain<String> buildWithAPI(
      OpenAiCompletionProvider provider, String query, String pluginURL, String specAPI) {
    return new EdgeChain<>(
        PluginBuilder.requestAPI(
            new LLMService(provider), new Endpoint(pluginURL), new Endpoint(specAPI), query));
  }

  public static EdgeChain<String> buildWithAPI(
      OpenAiCompletionProvider provider,
      String query,
      String pluginURL,
      String specAPI,
      RetryPolicy retryPolicy) {
    return new EdgeChain<>(
        PluginBuilder.requestAPI(
            new LLMService(provider),
            new Endpoint(pluginURL, retryPolicy),
            new Endpoint(specAPI, retryPolicy),
            query));
  }

  public static EdgeChain<String> buildWithJSON(
      OpenAiCompletionProvider provider, PluginJSONParser parser, String query) {
    return new EdgeChain<>(PluginBuilder.requestJSON(new LLMService(provider), parser, query));
  }
}
