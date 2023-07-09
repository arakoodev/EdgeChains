package com.edgechain.lib.openai.plugin.services;

import com.edgechain.lib.openai.plugin.parser.PluginParser;
import com.edgechain.lib.openai.plugin.response.PluginResponse;
import com.edgechain.lib.openai.providers.OpenAiCompletionProvider;
import com.edgechain.lib.response.StringResponse;
import com.edgechain.lib.rxjava.retry.impl.FixedDelay;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import com.fasterxml.jackson.core.JacksonException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.reactivex.rxjava3.core.Observable;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestTemplate;

import java.util.Collections;
import java.util.Iterator;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.TimeUnit;

public class PluginService {

  private RestTemplate restTemplate = new RestTemplate();

  private static final String DEFAULT_MESSAGE = "Couldn't extract information about: ";

  private final OpenAiCompletionProvider provider;
  private final PluginResponse pluginResponse;
  private final String initialPrompt;
  private final String query;

  public PluginService(
      OpenAiCompletionProvider provider,
      PluginResponse pluginResponse,
      String initialPrompt,
      String query) {
    this.provider = provider;
    this.pluginResponse = pluginResponse;
    this.initialPrompt = initialPrompt;
    this.query = query;
  }

  public EdgeChain<String> request() {

    return new EdgeChain<String>(
            Observable.create(
                emitter -> {
                  try {

                    StringBuilder prompt = new StringBuilder();
                    prompt
                        .append(initialPrompt)
                        .append("\n")
                        .append(query)
                        .append("\n"); // Updating Prompt

                    // Step 4: Send The Request  & Now Append the Parse Response to Prompt;
                    String initialResponse = initializePlugin(provider, pluginResponse, prompt);
                    prompt.append(initialResponse);

                    //                         Step 8: Fetch JSON Response from URLs extracted via
                    // ActionInput;
                    String jsonResponse = sendRequestWithOpenAPISpec(provider, prompt);
                    prompt.append(jsonResponse);

                    if (jsonResponse.isEmpty()) throw new RuntimeException(DEFAULT_MESSAGE + query);
                    else emitter.onNext(this.sendExtractedJsonResponse(provider, prompt));

                    emitter.onComplete();

                  } catch (final Exception e) {
                    emitter.onError(e);
                  }
                }))
        .retry(new FixedDelay(4, 0, TimeUnit.SECONDS));
  }

  private String initializePlugin(
      OpenAiCompletionProvider provider, PluginResponse pluginResponse, StringBuilder prompt) {
    try {
      // Step 2: Create PluginRequest (which act as JSON body for RestTemplate) & Send POST request
      // to OPENAPI Completion
      provider.request(prompt.toString()).get();

      // Step 3: Parse The Initial Response Using PluginParser
      return PluginParser.parse(
          pluginResponse.getPlugin().getName_for_model(), pluginResponse.getOpenApiSpec());
    } catch (final Exception e) {
      throw new RuntimeException(e.getMessage());
    }
  }

  private String sendRequestWithOpenAPISpec(
      OpenAiCompletionProvider provider, StringBuilder prompt) {
    try {
      System.out.println("Logging");

      // Step 5: Create PluginRequest & Send To CreateCompletion OpenAPI
      StringResponse completionResponse = provider.request(prompt.toString()).get();

      // Step 6: Parse the Response & Fetch Http GET request from ActionInput
      List<String> urlList = PluginParser.extractUrls(completionResponse.getResponse());

      // Step 7: Loop Over URL List & Test if anyone of them works;
      String jsonResponse = null;

      System.out.println("URL List: " + urlList.size());

      Iterator<String> iterator = urlList.iterator();
      while (iterator.hasNext()) {
        String str = iterator.next();
        System.out.println("URL: " + str);
        jsonResponse = extractJsonBody(str);
        if (Objects.nonNull(jsonResponse)) {
          break;
        }
      }

      return Objects.requireNonNullElse(jsonResponse, "");

    } catch (final Exception e) {
      throw new RuntimeException(e.getMessage());
    }
  }

  private String sendExtractedJsonResponse(
      OpenAiCompletionProvider provider, StringBuilder prompt) {
    try {

      StringResponse completionResponse = provider.request(prompt.toString()).get();
      return PluginParser.getFinalAnswer(completionResponse.getResponse());
    } catch (final Exception e) {
      throw new RuntimeException(e.getMessage());
    }
  }

  // Validating if the response is JSON & returning it;
  private String extractJsonBody(String url) {

    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_JSON);
    headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));

    // Create HttpEntity with headers and body
    HttpEntity<String> entity = new HttpEntity<>(headers);

    try {
      String body = this.restTemplate.exchange(url, HttpMethod.GET, entity, String.class).getBody();

      if (isValidJSON(body)) {
        return body;
      }
      return null;
    } catch (final Exception e) {
      return null;
    }
  }

  private boolean isValidJSON(String json) {

    ObjectMapper mapper = new ObjectMapper().enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS);

    try {
      mapper.readTree(json);
    } catch (JacksonException e) {
      return false;
    }
    return true;
  }
}
