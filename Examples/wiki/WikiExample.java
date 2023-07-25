package com.edgechain;

import com.edgechain.lib.configuration.domain.CorsEnableOrigins;
import com.edgechain.lib.configuration.domain.ExcludeMappingFilter;
import com.edgechain.lib.endpoint.impl.OpenAiEndpoint;
import com.edgechain.lib.endpoint.impl.WikiEndpoint;
import com.edgechain.lib.jsonnet.JsonnetArgs;
import com.edgechain.lib.jsonnet.JsonnetLoader;
import com.edgechain.lib.jsonnet.enums.DataType;
import com.edgechain.lib.jsonnet.impl.FileJsonnetLoader;
import com.edgechain.lib.request.ArkRequest;
import com.edgechain.lib.response.ArkResponse;
import com.edgechain.lib.rxjava.retry.impl.ExponentialDelay;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;

import java.util.Arrays;
import java.util.List;
import java.util.concurrent.TimeUnit;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import static com.edgechain.lib.constants.EndpointConstants.OPENAI_CHAT_COMPLETION_API;

@SpringBootApplication
public class WikiExample {

  private final String OPENAI_AUTH_KEY = "";

  public static void main(String[] args) {
    System.setProperty("server.port", "8080");
    SpringApplication.run(WikiExample.class, args);
  }


  // Adding Cors ==> You can configure multiple cors w.r.t your urls.;
  @Bean
  @Primary
  public CorsEnableOrigins corsEnableOrigins() {
    CorsEnableOrigins origins = new CorsEnableOrigins();
    origins.setOrigins(
            Arrays.asList("http://localhost:4200","http://localhost:4201"));
    return origins;
  }

  /**
   * Optional, Create it to exclude api calls from filtering; otherwise API calls will filter via
   * ROLE_BASE access *
   */
  @Bean
  @Primary
  public ExcludeMappingFilter mappingFilter() {
    ExcludeMappingFilter mappingFilter = new ExcludeMappingFilter();
    mappingFilter.setRequestGet(List.of("/v1/examples/**"));
    return mappingFilter;
  }

  @RestController
  @RequestMapping("/v1/examples")
  public class WikiController {

    /**
     * Objective: Get the Content From Wikipedia & then pass the prompt: {Create 5-bullet point
     * summary of: } + {wikiContent} to OpenAiChatCompletion API.
     *
     * @return ArkResponse
     */
    @GetMapping(
            value = "/wiki-summary",
            produces = {MediaType.APPLICATION_JSON_VALUE, MediaType.TEXT_EVENT_STREAM_VALUE})
    public ArkResponse wikiSummary(ArkRequest arkRequest) {

      String query = arkRequest.getQueryParam("query");
      boolean stream = arkRequest.getBooleanHeader("stream");

      // Step 1: Create JsonnetLoader to Load JsonnetFile & Pass Args To Jsonnet
      JsonnetLoader loader =
              new FileJsonnetLoader("R:\\Github\\wiki.jsonnet")
                      .put("keepMaxTokens", new JsonnetArgs(DataType.BOOLEAN, "true"))
                      .put("maxTokens", new JsonnetArgs(DataType.INTEGER, "4096"));

      /* Step 2: Create WikiEndpoint to extract content from Wikipedia;
      If RetryPolicy is not passed; then there won't be any backoff mechanism.... */
      // To allow, backoff strategy you can pass either of two strategies new FixedDelay() new
      // ExponentialDelay()`
      WikiEndpoint wikiEndpoint = new WikiEndpoint();

      /* Step 3: Create OpenAiEndpoint to communicate with OpenAiServices; */
      OpenAiEndpoint openAiEndpoint =
              new OpenAiEndpoint(
                      OPENAI_CHAT_COMPLETION_API,
                      OPENAI_AUTH_KEY,
                      "gpt-3.5-turbo",
                      "user",
                      0.7,
                      stream,
                      new ExponentialDelay(3, 5, 2, TimeUnit.SECONDS));

      return new EdgeChain<>(wikiEndpoint.getPageContent(query))
              .transform(
                      wiki -> {
                        loader
                                .put("keepContext", new JsonnetArgs(DataType.BOOLEAN, "true"))
                                .put(
                                        "context",
                                        new JsonnetArgs(
                                                DataType.STRING,
                                                wiki.getText())) // Step 4: Concatenate ${Base Prompt} + ${Wiki Output}
                                .loadOrReload(); // Step 5: Reloading Jsonnet File

                        return loader.get("prompt");
                      })
              .transform(openAiEndpoint::getChatCompletion)
              .getArkResponse();
    }

  }
}
