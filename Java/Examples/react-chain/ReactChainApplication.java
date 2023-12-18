package com.edgechain;

import com.edgechain.lib.endpoint.impl.llm.OpenAiChatEndpoint;
import com.edgechain.lib.jsonnet.JsonnetArgs;
import com.edgechain.lib.jsonnet.JsonnetLoader;
import com.edgechain.lib.jsonnet.enums.DataType;
import com.edgechain.lib.jsonnet.impl.FileJsonnetLoader;
import com.edgechain.lib.request.ArkRequest;
import com.edgechain.lib.rxjava.retry.impl.ExponentialDelay;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;

import java.util.Properties;
import java.util.concurrent.TimeUnit;

import static com.edgechain.lib.constants.EndpointConstants.OPENAI_CHAT_COMPLETION_API;

@SpringBootApplication
public class ReactChainApplication {

  private static final String OPENAI_AUTH_KEY = "";
  private static final String OPENAI_ORG_ID = "";
  private static OpenAiChatEndpoint userChatEndpoint;
  private static JsonnetLoader loader = new FileJsonnetLoader("./react-chain/react-chain.jsonnet");

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
        new OpenAiChatEndpoint(
            OPENAI_CHAT_COMPLETION_API,
            OPENAI_AUTH_KEY,
            OPENAI_ORG_ID,
            "gpt-3.5-turbo",
            "user",
            0.7,
            false,
            new ExponentialDelay(3, 5, 2, TimeUnit.SECONDS));
  }

  @RestController
  @RequestMapping("/v1/examples")
  public class ReactChainController {

    @PostMapping(value = "/react-chain")
    public String reactChain(ArkRequest arkRequest) {
      String prompt = (String) arkRequest.getBody().get("prompt");

      loader.put("context", new JsonnetArgs(DataType.STRING, "This is context"));
      loader.put("gptResponse", new JsonnetArgs(DataType.STRING, ""));
      loader.put("question", new JsonnetArgs(DataType.STRING, prompt));
      loader.put("text", new JsonnetArgs(DataType.STRING, ""));

      try {
        loader.loadOrReload();
      } catch (Exception e) {
        e.printStackTrace();
        return "Please broaden the search query!";
      }
      prompt = loader.get("initialPrompt");

      String gptResponse = gptFn(prompt, arkRequest);

      loader.put("context", new JsonnetArgs(DataType.STRING, prompt));
      loader.put("gptResponse", new JsonnetArgs(DataType.STRING, gptResponse));

      while (!checkIfFinished(gptResponse)) {
        try {
          loader.loadOrReload();
        } catch (Exception e) {
          return "Please broaden the search query or try again!";
        }

        String observation = loader.get("observation");
        if (observation.isEmpty())
          return "No info found on Wiki! Please broaden the search query or try again!";

        prompt = loader.get("prompt");
        gptResponse = gptFn(prompt, arkRequest);

        loader.put("context", new JsonnetArgs(DataType.STRING, prompt));
        loader.put("gptResponse", new JsonnetArgs(DataType.STRING, gptResponse));
      }

      // Extracting the final answer
      loader.put("text", new JsonnetArgs(DataType.STRING, gptResponse));

      try {
        loader.loadOrReload();
        return loader.get("finalAns");
      } catch (Exception e) {
        return "Please broaden the search query or try again!";
      }
    }

    private boolean checkIfFinished(String gptResponse) {
      return gptResponse.contains("Finish");
    }

    private String gptFn(String prompt, ArkRequest arkRequest) {
      return new EdgeChain<>(userChatEndpoint.chatCompletion(prompt, "React-Chain", arkRequest))
          .get()
          .getChoices()
          .get(0)
          .getMessage()
          .getContent();
    }
  }
}
