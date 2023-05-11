package com.app.openai.plugin.services;

import com.app.openai.chains.PluginChain;
import com.app.openai.llm.service.LLMService;
import com.app.openai.plugin.parser.PluginParser;
import com.app.openai.plugin.response.PluginResponse;
import com.app.rxjava.utils.Atom;
import com.app.rxjava.utils.AtomInteger;
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

public class PluginService {

  private RestTemplate restTemplate = new RestTemplate();

  private static final Integer DEFAULT_RETRY_ATTEMPT = 3;
  private static final String DEFAULT_MESSAGE = "Couldn't extract information about: ";

  private final LLMService llmService;
  private final PluginResponse pluginResponse;
  private final String initialPrompt;
  private final String query;

  public PluginService(
      LLMService llmService, PluginResponse pluginResponse, String initialPrompt, String query) {
    this.llmService = llmService;
    this.pluginResponse = pluginResponse;
    this.initialPrompt = initialPrompt;
    this.query = query;
  }

  public Observable<String> request() {

    AtomInteger retryCount = AtomInteger.of(0);
    Atom<Boolean> terminateWhileLoop = Atom.of(false);

    return new PluginChain(
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
                    String initialResponse = initializePlugin(llmService, pluginResponse, prompt);
                    prompt.append(initialResponse);

                    //                         Step 8: Fetch JSON Response from URLs extracted via
                    // ActionInput;
                    String jsonResponse = sendRequestWithOpenAPISpec(llmService, prompt);
                    prompt.append(jsonResponse);

                    if (jsonResponse.isEmpty()) {
                      // WILL Retry FOR MAX_RETRY + 1 = 3 + 1; 4 times...
                      if (retryCount.incrementAndGet() > DEFAULT_RETRY_ATTEMPT) {
                        terminateWhileLoop.set(true);
                      }
                      emitter.onNext(DEFAULT_MESSAGE + query);
                    } else {
                      terminateWhileLoop.set(true);
                      emitter.onNext(this.sendExtractedJsonResponse(llmService, prompt));
                    }

                    emitter.onComplete();

                  } catch (final Exception e) {
                    emitter.onError(e);
                  }
                }))
        .doWhileLoop(terminateWhileLoop::get)
        .getObservable();
  }

  private String initializePlugin(
      LLMService llmService, PluginResponse pluginResponse, StringBuilder prompt) {
    try {
      // Step 2: Create PluginRequest (which act as JSON body for RestTemplate) & Send POST request
      // to OPENAPI Completion
      llmService.request(prompt.toString()).getWithRetry();

      // Step 3: Parse The Initial Response Using PluginParser
      return PluginParser.parse(
          pluginResponse.getPlugin().getName_for_model(), pluginResponse.getOpenApiSpec());
    } catch (final Exception e) {
      throw new RuntimeException(e.getMessage());
    }
  }

  private String sendRequestWithOpenAPISpec(LLMService llmService, StringBuilder prompt) {
    try {
      System.out.println("Logging");

      // Step 5: Create PluginRequest & Send To CreateCompletion OpenAPI
      String response = llmService.request(prompt.toString()).getWithRetry();

      // Step 6: Parse the Response & Fetch Http GET request from ActionInput
      List<String> urlList = PluginParser.extractUrls(response);

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

  private String sendExtractedJsonResponse(LLMService llmService, StringBuilder prompt) {
    try {
      String response = llmService.request(prompt.toString()).getWithRetry();
      return PluginParser.getFinalAnswer(response);
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
