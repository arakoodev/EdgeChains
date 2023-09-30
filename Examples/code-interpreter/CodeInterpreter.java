package com.edgechain;

import static com.edgechain.lib.constants.EndpointConstants.OPENAI_CHAT_COMPLETION_API;

import java.util.concurrent.TimeUnit;

import com.edgechain.lib.endpoint.impl.llm.OpenAiChatEndpoint;
import org.json.JSONException;
import org.json.JSONObject;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.edgechain.lib.codeInterpreter.Eval;
import com.edgechain.lib.jsonnet.JsonnetArgs;
import com.edgechain.lib.jsonnet.JsonnetLoader;
import com.edgechain.lib.jsonnet.enums.DataType;
import com.edgechain.lib.jsonnet.impl.FileJsonnetLoader;
import com.edgechain.lib.request.ArkRequest;
import com.edgechain.lib.rxjava.retry.impl.ExponentialDelay;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

@SpringBootApplication
public class CodeInterpreter {

  private static final String OPENAI_AUTH_KEY = "";
  private static OpenAiChatEndpoint userChatEndpoint;
  private static final ObjectMapper objectMapper = new ObjectMapper();
  private static JsonnetLoader loader =
      new FileJsonnetLoader("./code-interpreter/code-interpreter.jsonnet");

  public static void main(String[] args) {
    System.setProperty("server.port", "8080");
    new SpringApplicationBuilder(CodeInterpreter.class).run(args);
  }

  @RestController
  @RequestMapping("/v1/examples")
  public class interpreter {

    @PostMapping("/code-interpreter")
    public double interpret(ArkRequest arkRequest) throws JSONException {

      JSONObject json = arkRequest.getBody();

      userChatEndpoint =
          new OpenAiChatEndpoint(
              OPENAI_CHAT_COMPLETION_API,
              OPENAI_AUTH_KEY,
              "gpt-3.5-turbo",
              "user",
              0.7,
              new ExponentialDelay(3, 5, 2, TimeUnit.SECONDS));

      loader
          .put("prompt", new JsonnetArgs(DataType.STRING, json.getString("prompt")))
          .loadOrReload();

      String prompt = loader.get("extract");

      while (true) {

        String response =
            userChatEndpoint
                .chatCompletion(prompt, "code-interpreter", arkRequest)
                .blockingFirst()
                .getChoices()
                .get(0)
                .getMessage()
                .getContent();

        try {
          JsonNode jsonNode = objectMapper.readTree(response);
          System.out.println("Valid JSON from chatgpt " + jsonNode);

          String tool = jsonNode.get("action").get("tool").asText();
          String arg = jsonNode.get("action").get("arg").asText();

          if ("CodeInterpreter".equals(tool)) {
            Double val = Eval.evaluateExpression(arg);
            System.out.println("CodeInterpreter: " + val);

            prompt +=
                String.format("\n%s\nObservation: CodeInterpreter returned %s", response, val);
          } else if ("Finish".equals(tool)) {
            System.out.println("FINAL ANSWER: " + arg);
            return Double.parseDouble(arg);
          }
        } catch (JsonProcessingException e) {
          System.out.println("Invalid JSON from chatgpt " + response);
          e.printStackTrace();
        }
      }
    }
  }
}
