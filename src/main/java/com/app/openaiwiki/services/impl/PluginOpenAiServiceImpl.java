package com.app.openaiwiki.services.impl;

import com.app.openai.endpoint.Endpoint;
import com.app.openai.llm.provider.LLMProvider;
import com.app.openai.llm.provider.impl.OpenAiCompletionProvider;
import com.app.openai.llm.service.LLMService;
import com.app.openai.plugin.builder.PluginBuilder;
import com.app.openai.plugin.parser.PluginJSONParser;
import com.app.openaiwiki.chains.CalculatorChain;
import com.app.openaiwiki.chains.KlarnaChain;
import com.app.openaiwiki.chains.ShopBoxChain;
import com.app.openaiwiki.constants.JSONPluginConstants;
import com.app.openaiwiki.services.PluginOpenAiService;
import org.springframework.stereotype.Service;

@Service
public class PluginOpenAiServiceImpl implements PluginOpenAiService {

  private static final String OPENAPI_COMPLETION_API = "https://api.openai.com/v1/completions";
  private static final String OPENAI_API_KEY = "";

  private static final String KLARNA_PLUGIN_URL =
      "https://www.klarna.com/.well-known/ai-plugin.json";
  private static final String KLARNA_SPEC_API =
      "https://www.klarna.com/us/shopping/public/openai/v0/api-docs/";

  private static final String SHOP_PLUGIN_URL =
      "https://server.shop.app/.well-known/ai-plugin.json";
  private static final String SHOP_SPEC_API = "https://server.shop.app/openai/v1/api.json";

  @Override
  public KlarnaChain requestKlarna(String query) {
    LLMProvider llmProvider =
        new OpenAiCompletionProvider(
            new Endpoint(OPENAPI_COMPLETION_API, OPENAI_API_KEY), "text-davinci-003", 0.3, 2048);

    LLMService llmService = new LLMService(llmProvider);

    return new KlarnaChain(
        PluginBuilder.requestAPI(
            llmService, new Endpoint(KLARNA_PLUGIN_URL), new Endpoint(KLARNA_SPEC_API), query));
  }

  @Override
  public ShopBoxChain requestShopBox(String query) {

    // Step 1: We have to define what kind of service we want to use
    LLMProvider llmProvider =
        new OpenAiCompletionProvider(
            new Endpoint(OPENAPI_COMPLETION_API, OPENAI_API_KEY), "text-davinci-003", 0.3, 2048);
    // Step 2:
    LLMService llmService = new LLMService(llmProvider);

    // Step 3:
    return new ShopBoxChain(
        PluginBuilder.requestAPI(
            llmService, new Endpoint(SHOP_PLUGIN_URL), new Endpoint(SHOP_SPEC_API), query));
  }

  @Override
  public CalculatorChain requestCalculator(String query) {
    // Step 1: We have to define what kind of service we want to use
    LLMProvider llmProvider =
        new OpenAiCompletionProvider(
            new Endpoint(OPENAPI_COMPLETION_API, OPENAI_API_KEY), "text-davinci-003", 0.3, 2048);
    // Step 2:
    LLMService llmService = new LLMService(llmProvider);

    // Step 3:
    return new CalculatorChain(
        PluginBuilder.requestJSON(
            llmService,
            new PluginJSONParser(
                JSONPluginConstants.calculatorPluginJSON,
                JSONPluginConstants.calculatorAPIConfigJSON,
                JSONPluginConstants.calculatorSpecJSON),
            query));
  }
}
