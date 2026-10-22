package com.app.openai.plugin.builder;

import com.app.openai.endpoint.Endpoint;
import com.app.openai.llm.service.LLMService;
import com.app.openai.plugin.parser.PluginJSONParser;
import com.app.openai.plugin.response.PluginResponse;
import com.app.openai.plugin.services.PluginResponseService;
import com.app.openai.plugin.services.PluginService;
import com.app.openai.plugin.tool.ApiConfig;
import com.app.openai.plugin.tool.PluginTool;
import com.app.openai.prompt.PromptTemplate;
import com.app.openai.prompt.impl.CompletionPrompt;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.reactivex.rxjava3.core.Observable;

public class PluginBuilder {

  public static Observable<String> requestAPI(
      LLMService llmService, Endpoint pluginAPI, Endpoint specAPI, String query) {

    // Create PluginResponseService Constructor
    PluginResponseService pluginResponseService = new PluginResponseService(pluginAPI, specAPI);

    // Fetch Plugin Information
    PluginResponse pluginResponse = pluginResponseService.getPluginResponse();

    // Use Plugin Service
    PluginService pluginService =
        new PluginService(
            llmService, pluginResponse, new CompletionPrompt(pluginResponse).getPrompt(), query);

    return pluginService.request();
  }

  public static Observable<String> requestAPI(
      LLMService llmService,
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
        new PluginService(llmService, pluginResponse, promptTemplate.getPrompt(), query);

    return pluginService.request();
  }

  public static Observable<String> requestJSON(
      LLMService llmService, PluginJSONParser pluginJSONParser, String query) {
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
              llmService, pluginResponse, new CompletionPrompt(pluginResponse).getPrompt(), query);

      return pluginService.request();
    } catch (final Exception e) {
      throw new RuntimeException(e.getMessage());
    }
  }

  public static Observable<String> requestJSON(
      LLMService llmService,
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
          new PluginService(llmService, pluginResponse, promptTemplate.getPrompt(), query);

      return pluginService.request();

    } catch (final Exception e) {
      throw new RuntimeException(e.getMessage());
    }
  }
}
