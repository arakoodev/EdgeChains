package com.edgechain;

import static com.edgechain.lib.constants.EndpointConstants.OPENAI_CHAT_COMPLETION_API;
import static com.edgechain.lib.constants.EndpointConstants.OPENAI_EMBEDDINGS_API;

import com.edgechain.lib.chains.RedisRetrieval;
import com.edgechain.lib.chains.Retrieval;
import com.edgechain.lib.chunk.enums.LangType;
import com.edgechain.lib.configuration.domain.CorsEnableOrigins;
import com.edgechain.lib.configuration.domain.ExcludeMappingFilter;
import com.edgechain.lib.configuration.domain.RedisEnv;
import com.edgechain.lib.context.domain.HistoryContext;
import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.impl.OpenAiEndpoint;
import com.edgechain.lib.endpoint.impl.RedisEndpoint;
import com.edgechain.lib.endpoint.impl.RedisHistoryContextEndpoint;
import com.edgechain.lib.index.enums.RedisDistanceMetric;
import com.edgechain.lib.jsonnet.JsonnetArgs;
import com.edgechain.lib.jsonnet.JsonnetLoader;
import com.edgechain.lib.jsonnet.enums.DataType;
import com.edgechain.lib.jsonnet.impl.FileJsonnetLoader;
import com.edgechain.lib.openai.response.ChatCompletionResponse;
import com.edgechain.lib.reader.impl.PdfReader;
import com.edgechain.lib.request.ArkRequest;
import com.edgechain.lib.response.ArkResponse;
import com.edgechain.lib.rxjava.retry.impl.ExponentialDelay;
import com.edgechain.lib.rxjava.retry.impl.FixedDelay;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;

import java.io.IOException;
import java.io.InputStream;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.IntStream;

import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

@SpringBootApplication
public class ReactChainApplication {

  private final String OPENAI_AUTH_KEY = "";

  public static void main(String[] args) {
    System.setProperty("server.port", "8080");
    SpringApplication.run(ReactChainApplication.class, args);
  }

  // Adding Cors ==> You can configure multiple cors w.r.t your urls.;
  @Bean
  @Primary
  public CorsEnableOrigins corsEnableOrigins() {
    CorsEnableOrigins origins = new CorsEnableOrigins();
    origins.setOrigins(Arrays.asList("http://localhost:4200", "http://localhost:4201"));
    return origins;
  }

  /* Optional (not required if you are not using Redis), always create bean with @Primary annotation */
  @Bean
  @Primary
  public RedisEnv redisEnv() {
    RedisEnv redisEnv = new RedisEnv();
    redisEnv.setUrl("");
    redisEnv.setPort(12285);
    redisEnv.setUsername("default");
    redisEnv.setPassword("");
    redisEnv.setTtl(3600); // Configuring ttl for HistoryContext;
    return redisEnv;
  }

  /**
   * Optional, Create it to exclude api calls from filtering; otherwise API calls will filter via
   * ROLE_BASE access *
   */
  @Bean
  @Primary
  public ExcludeMappingFilter mappingFilter() {
    ExcludeMappingFilter mappingFilter = new ExcludeMappingFilter();
    mappingFilter.setRequestPost(List.of("/v1/examples/**"));
    mappingFilter.setRequestGet(List.of("/v1/examples/**"));
    mappingFilter.setRequestDelete(List.of("/v1/examples/**"));
    mappingFilter.setRequestPut(List.of("/v1/examples/**"));
    return mappingFilter;
  }
  /************ EXAMPLE APIs **********************/

  @RestController
  @RequestMapping("/v1/examples")
  public class ExampleController {

    @GetMapping(value = "/react-chain")
    public String reactChain(@RequestBody String prompt) {
      StringBuilder context = new StringBuilder();
      JsonnetLoader loader =
              new FileJsonnetLoader("react-chain.jsonnet")
                      .put("context", new JsonnetArgs(DataType.STRING, "This is context"))
                      .put("gptResponse", new JsonnetArgs(DataType.STRING, ""))
                      .loadOrReload();
      String preset = loader.get("preset");
      OpenAiEndpoint userChatEndpoint =
              new OpenAiEndpoint(
                      OPENAI_CHAT_COMPLETION_API,
                      OPENAI_AUTH_KEY,
                      "gpt-3.5-turbo",
                      "user",
                      0.7,
                      new ExponentialDelay(3, 5, 2, TimeUnit.SECONDS));

      prompt = preset + " \nQuestion: " + prompt;

      String gptResponse = userChatEndpoint.getChatCompletion(prompt).blockingFirst().getChoices().get(0).getMessage().getContent();
      context.append(prompt);
      loader.put("context", new JsonnetArgs(DataType.STRING, context.toString()));
      loader.put("gptResponse", new JsonnetArgs(DataType.STRING, gptResponse));

      while(!checkIfFinished(gptResponse)) {
        loader.loadOrReload();
        prompt = loader.get("prompt");
        gptResponse = userChatEndpoint.getChatCompletion(prompt).blockingFirst().getChoices().get(0).getMessage().getContent();
        context.append("\n" + prompt);
        loader.put("context", new JsonnetArgs(DataType.STRING, context.toString()));
        loader.put("gptResponse", new JsonnetArgs(DataType.STRING, gptResponse));
      }
      return gptResponse.substring(gptResponse.indexOf("Finish[") + 7, gptResponse.indexOf("]"));
    }

    private boolean checkIfFinished(String gptResponse) {
      return gptResponse.contains("Finish");
    }
  }

}
