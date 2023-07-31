package com.edgechain;
import com.edgechain.lib.endpoint.impl.OpenAiEndpoint;
import com.edgechain.lib.jsonnet.JsonnetArgs;
import com.edgechain.lib.jsonnet.JsonnetLoader;
import com.edgechain.lib.jsonnet.enums.DataType;
import com.edgechain.lib.jsonnet.impl.FileJsonnetLoader;
import com.edgechain.lib.request.ArkRequest;
import com.edgechain.lib.rxjava.retry.impl.ExponentialDelay;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Properties;
import java.util.concurrent.TimeUnit;

import static com.edgechain.lib.constants.EndpointConstants.OPENAI_CHAT_COMPLETION_API;

@SpringBootApplication
public class ReactChainApplication {

  private static final String OPENAI_AUTH_KEY = "";

  private static OpenAiEndpoint userChatEndpoint;


  public static void main(String[] args) {
    System.setProperty("server.port", "8080");

    Properties properties = new Properties();

    properties.setProperty("spring.jpa.show-sql", "true");
    properties.setProperty("spring.jpa.properties.hibernate.format_sql", "true");

    // Adding Cors ==> You can configure multiple cors w.r.t your urls.;
    properties.setProperty("cors.origins", "http://localhost:4200");

    // If you want to use PostgreSQL only; then just provide dbHost, dbUsername & dbPassword.
    // If you haven't specified PostgreSQL, then logs won't be stored.
    properties.setProperty("postgres.db.host", "");
    properties.setProperty("postgres.db.username", "");
    properties.setProperty("postgres.db.password", "");


    new SpringApplicationBuilder(ReactChainApplication.class).properties(properties).run(args);

    userChatEndpoint =
            new OpenAiEndpoint(
                    OPENAI_CHAT_COMPLETION_API,
                    OPENAI_AUTH_KEY,
                    "gpt-3.5-turbo",
                    "user",
                    0.7,
                    new ExponentialDelay(3, 5, 2, TimeUnit.SECONDS));

  }

  @RestController
  @RequestMapping("/v1/examples")
  public class ExampleController {

    @GetMapping(value = "/sample")
    public String sample() {
      JsonnetLoader loader = new FileJsonnetLoader("sample.jsonnet")
              .put("maxTokens", new JsonnetArgs(DataType.INTEGER, "4096"))
              .put("flag", new JsonnetArgs(DataType.BOOLEAN, "true"))
              .loadOrReload();
      return "sample";
    }

    @GetMapping(value = "/react-chain")
    public String reactChain(ArkRequest arkRequest) {
      String prompt = (String) arkRequest.getBody().get("prompt");
      StringBuilder context = new StringBuilder();
      JsonnetLoader loader = new FileJsonnetLoader("react-chain.jsonnet")
              .put("context", new JsonnetArgs(DataType.STRING, "This is context"))
              .put("gptResponse", new JsonnetArgs(DataType.STRING, ""))
              .loadOrReload();
      String preset = loader.get("preset");

      prompt = preset + " \nQuestion: " + prompt;

      String gptResponse = userChatEndpoint.chatCompletion(prompt, "React-Chain", arkRequest).blockingFirst().getChoices().get(0).getMessage().getContent();
      context.append(prompt);
      loader.put("context", new JsonnetArgs(DataType.STRING, context.toString()));
      loader.put("gptResponse", new JsonnetArgs(DataType.STRING, gptResponse));

      while(!checkIfFinished(gptResponse)) {
        loader.loadOrReload();
        prompt = loader.get("prompt");
        gptResponse = userChatEndpoint.chatCompletion(prompt, "React-Chain", arkRequest).blockingFirst().getChoices().get(0).getMessage().getContent();
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
