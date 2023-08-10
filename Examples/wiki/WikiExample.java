package com.edgechain;

import com.edgechain.lib.endpoint.impl.OpenAiEndpoint;
import com.edgechain.lib.endpoint.impl.WikiEndpoint;
import com.edgechain.lib.jsonnet.JsonnetArgs;
import com.edgechain.lib.jsonnet.JsonnetLoader;
import com.edgechain.lib.jsonnet.enums.DataType;
import com.edgechain.lib.jsonnet.impl.FileJsonnetLoader;
import com.edgechain.lib.openai.request.ChatMessage;
import com.edgechain.lib.openai.response.ChatCompletionResponse;
import com.edgechain.lib.request.ArkRequest;
import com.edgechain.lib.response.ArkResponse;
import com.edgechain.lib.rxjava.retry.impl.ExponentialDelay;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;

import java.util.*;
import java.util.concurrent.TimeUnit;

import com.edgechain.lib.wiki.response.WikiResponse;
import com.knuddels.jtokkit.Encodings;
import com.knuddels.jtokkit.api.Encoding;
import com.knuddels.jtokkit.api.EncodingRegistry;
import com.knuddels.jtokkit.api.EncodingType;
import org.apache.commons.lang3.StringUtils;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.web.bind.annotation.GetMapping;
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

    properties.setProperty(
        "postgres.db.host", "");
    properties.setProperty("postgres.db.username", "postgres");
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
  public class WikiController {

    /**
     * Objective: Get the Content From Wikipedia & then pass the prompt: {Create 5-bullet point
     * summary of: } + {wikiContent} to OpenAiChatCompletion API.
     *
     * @return ArkResponseObservable
     */
    @GetMapping(value = "/wiki-summary")
    public ArkResponse wikiSummary(ArkRequest arkRequest) {

      String query = arkRequest.getQueryParam("query");
      boolean stream = arkRequest.getBooleanHeader("stream");

      // Configure GPT4Endpoint
      gpt4Endpoint.setStream(stream);

      //  Chain 1 ==> WikiChain
      EdgeChain<WikiResponse> wikiChain = new EdgeChain<>(wikiEndpoint.getPageContent(query));

      //   Chain 2 ===> Creating Prompt Chain & Return ChatCompletion
      EdgeChain<String> promptChain = wikiChain.transform(this::fn);

      // Chain 3 ==> Pass Prompt to ChatCompletion API & Return ArkResponseObservable
      EdgeChain<ChatCompletionResponse> openAiChain =
          new EdgeChain<>(gpt4Endpoint.chatCompletion(promptChain.get(), "WikiChain", arkRequest));

      /**
       * The best part is flexibility with just one method EdgeChainsSDK will return response either
       * in json or stream; The real magic happens here. Streaming happens only if your logic allows otherwise;
       * it will return text/eventstream
       */

      // Note: When you call getArkResponse() or getArkStreamResponse() ==> Only then your streams are executed...
      if(stream) return openAiChain.getArkStreamResponse();
      else return openAiChain.getArkResponse();

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
