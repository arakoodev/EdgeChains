package com.edgechain.lib.openai.plugin.builder;

import com.edgechain.lib.endpoint.Endpoint;
import com.edgechain.lib.openai.plugin.parser.PluginJSONParser;
import com.edgechain.lib.openai.plugin.prompt.CompletionPrompt;
import com.edgechain.lib.openai.plugin.response.PluginResponse;
import com.edgechain.lib.openai.plugin.services.PluginResponseService;
import com.edgechain.lib.openai.plugin.services.PluginService;
import com.edgechain.lib.openai.plugin.tool.ApiConfig;
import com.edgechain.lib.openai.plugin.tool.PluginTool;
import com.edgechain.lib.openai.prompt.PromptTemplate;
import com.edgechain.lib.openai.providers.OpenAiCompletionProvider;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import com.fasterxml.jackson.databind.ObjectMapper;

public class PluginBuilder {

  public static EdgeChain<String> requestAPI(
      OpenAiCompletionProvider provider, Endpoint pluginAPI, Endpoint specAPI, String query) {

    // Create PluginResponseService Constructor
    PluginResponseService pluginResponseService = new PluginResponseService(pluginAPI, specAPI);

    // Fetch Plugin Information
    PluginResponse pluginResponse = pluginResponseService.getPluginResponse();

    // Use Plugin Service
    PluginService pluginService =
        new PluginService(
            provider, pluginResponse, new CompletionPrompt(pluginResponse).getPrompt(), query);

    return pluginService.request();
  }

  public static EdgeChain<String> requestAPI(
      OpenAiCompletionProvider provider,
      Endpoint pluginAPI,
      Endpoint specAPI,
      PromptTemplate promptTemplate,
      String query) {

    // Create PluginResponseService Constructor
    PluginResponseService pluginResponseService = new PluginResponseService(pluginAPI, specAPI);

    // Fetch Plugin Information
    PluginResponse pluginResponse = pluginResponseService.getPluginResponse();

    // Use Plugin Service
    PluginService pluginService =
        new PluginService(provider, pluginResponse, promptTemplate.getPrompt(), query);

    return pluginService.request();
  }

  public static EdgeChain<String> requestJSON(
      OpenAiCompletionProvider provider, PluginJSONParser pluginJSONParser, String query) {
    try {
      ObjectMapper objectMapper = new ObjectMapper();

      PluginTool pluginTool =
          objectMapper.readValue(pluginJSONParser.getPluginJSON(), PluginTool.class);
      pluginTool.setApi(
          objectMapper.readValue(pluginJSONParser.getApiConfigJson(), ApiConfig.class));

      PluginResponse pluginResponse =
          new PluginResponse(pluginTool, pluginJSONParser.getSpecAPIJson());

      // Use Plugin Service
      PluginService pluginService =
          new PluginService(
              provider, pluginResponse, new CompletionPrompt(pluginResponse).getPrompt(), query);

      return pluginService.request();
    } catch (final Exception e) {
      throw new RuntimeException(e.getMessage());
    }
  }

  public static EdgeChain<String> requestJSON(
      OpenAiCompletionProvider provider,
      PluginJSONParser pluginJSONParser,
      PromptTemplate promptTemplate,
      String query) {
    try {

      ObjectMapper objectMapper = new ObjectMapper();

      PluginTool pluginTool =
          objectMapper.readValue(pluginJSONParser.getPluginJSON(), PluginTool.class);
      pluginTool.setApi(
          objectMapper.readValue(pluginJSONParser.getApiConfigJson(), ApiConfig.class));

      PluginResponse pluginResponse =
          new PluginResponse(pluginTool, pluginJSONParser.getSpecAPIJson());

      // Use Plugin Service
      PluginService pluginService =
          new PluginService(provider, pluginResponse, promptTemplate.getPrompt(), query);

      return pluginService.request();

    } catch (final Exception e) {
      throw new RuntimeException(e.getMessage());
    }
  }
}
