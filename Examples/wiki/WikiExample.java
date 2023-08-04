package com.edgechain;

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

import java.util.*;
import java.util.concurrent.TimeUnit;

import com.edgechain.lib.wiki.response.WikiResponse;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import static com.edgechain.lib.constants.EndpointConstants.OPENAI_CHAT_COMPLETION_API;

@SpringBootApplication
public class WikiExample {

  private static final String OPENAI_AUTH_KEY = "";

  /* Step 3: Create OpenAiEndpoint to communicate with OpenAiServices; */
  private static OpenAiEndpoint gpt4Endpoint;
  private static WikiEndpoint wikiEndpoint;

  private final JsonnetLoader loader = new FileJsonnetLoader("./wiki/wiki.jsonnet");

  public static void main(String[] args) {
    System.setProperty("server.port", "8080");

    // Optional, for logging SQL queries (shouldn't be used in prod)
    Properties properties = new Properties();

    // Adding Cors ==> You can configure multiple cors w.r.t your urls.;
    properties.setProperty("cors.origins", "http://localhost:4200");

    properties.setProperty("spring.jpa.show-sql", "true");
    properties.setProperty("spring.jpa.properties.hibernate.format_sql", "true");

    properties.setProperty("postgres.db.host", "");
    properties.setProperty("postgres.db.username", "");
    properties.setProperty("postgres.db.password", "");

    new SpringApplicationBuilder(WikiExample.class).properties(properties).run(args);

    wikiEndpoint = new WikiEndpoint();

    gpt4Endpoint =
        new OpenAiEndpoint(
            OPENAI_CHAT_COMPLETION_API,
            OPENAI_AUTH_KEY,
            "gpt-4",
            "user",
            0.7,
            new ExponentialDelay(3, 5, 2, TimeUnit.SECONDS));
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

      // Configure GPT4Endpoint
      gpt4Endpoint.setStream(stream);

      // Create Wiki Chain
      EdgeChain<WikiResponse> wikiChain = new EdgeChain<>(wikiEndpoint.getPageContent(query));

      return wikiChain
          .transform(this::fn) // create prompt using JsonnetLoader ${basePrompt} +  ${wikiContent}
          .transform(prompt -> gpt4Endpoint.chatCompletion(prompt, "WikiChain", arkRequest))
          .getArkResponse();
    }

    private String fn(WikiResponse wiki) {
      loader
          .put("keepMaxTokens", new JsonnetArgs(DataType.BOOLEAN, "true"))
          .put("maxTokens", new JsonnetArgs(DataType.INTEGER, "4096"))
          .put("keepContext", new JsonnetArgs(DataType.BOOLEAN, "true"))
          .put(
              "context",
              new JsonnetArgs(
                  DataType.STRING,
                  wiki.getText())) // Step 4: Concatenate ${Base Prompt} + ${Wiki Output}
          .loadOrReload(); // Step 5: Reloading Jsonnet File

      return loader.get("prompt");
    }
  }
}
