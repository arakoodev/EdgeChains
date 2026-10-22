package com.edgechain;

import static com.edgechain.lib.constants.EndpointConstants.OPENAI_CHAT_COMPLETION_API;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.TimeUnit;

import com.edgechain.lib.endpoint.impl.llm.OpenAiChatEndpoint;
import org.json.JSONObject;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;

import com.edgechain.lib.constants.EndpointConstants;
import com.edgechain.lib.jsonFormat.request.FunctionRequest;
import com.edgechain.lib.jsonFormat.request.Message;
import com.edgechain.lib.jsonFormat.request.OpenApiFunctionRequest;
import com.edgechain.lib.jsonFormat.request.Parameters;
import com.edgechain.lib.jsonFormat.response.FunctionResponse;
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
public class JsonFormat {

  private static final String OPENAI_AUTH_KEY = "";

  // need only for situation endpoint
  private static final String OPENAI_ORG_ID = "";

  private static OpenAiChatEndpoint userChatEndpoint;
  private static JsonnetLoader loader = new FileJsonnetLoader("./json/json-format.jsonnet");
  private static JsonnetLoader functionLoader = new FileJsonnetLoader("./json/function.jsonnet");
  private static final ObjectMapper objectMapper = new ObjectMapper();

  public static void main(String[] args) {
    System.setProperty("server.port", "8080");
    new SpringApplicationBuilder(JsonFormat.class).run(args);

    loader
        .put("prompt", new JsonnetArgs(DataType.STRING, ""))
        .put("format", new JsonnetArgs(DataType.STRING, ""))
        .put("situation", new JsonnetArgs(DataType.STRING, ""))
        .put("validAction", new JsonnetArgs(DataType.STRING, ""))
        .put("callToAction", new JsonnetArgs(DataType.STRING, ""))
        .put("actionFormat", new JsonnetArgs(DataType.STRING, ""))
        .put("response1", new JsonnetArgs(DataType.STRING, ""))
        .put("response2", new JsonnetArgs(DataType.STRING, ""))
        .put("response3", new JsonnetArgs(DataType.STRING, ""));
  }

  @Bean
  public RestTemplate functionCall() {
    RestTemplate restTemplate = new RestTemplate();
    restTemplate
        .getInterceptors()
        .add(
            (request, body, execution) -> {
              request.getHeaders().add("Authorization", "Bearer " + OPENAI_AUTH_KEY);
              request.getHeaders().add("OpenAI-Organization", OPENAI_ORG_ID);
              return execution.execute(request, body);
            });
    return restTemplate;
  }

  @RestController
  @RequestMapping("/v1")
  public class ExampleController {

    @PostMapping(value = "/extract")
    public String extract(ArkRequest arkRequest) {

      userChatEndpoint =
          new OpenAiChatEndpoint(
              OPENAI_CHAT_COMPLETION_API,
              OPENAI_AUTH_KEY,
              "gpt-3.5-turbo",
              "user",
              0.7,
              new ExponentialDelay(3, 5, 2, TimeUnit.SECONDS));

      JSONObject json = arkRequest.getBody();

      loader
          .put("prompt", new JsonnetArgs(DataType.STRING, json.getString("prompt")))
          .put("format", new JsonnetArgs(DataType.STRING, json.getString("format")))
          .loadOrReload();

      String gptResponse =
          userChatEndpoint
              .chatCompletion(loader.get("extract"), "Json-format", arkRequest)
              .blockingFirst()
              .getChoices()
              .get(0)
              .getMessage()
              .getContent();

      if (gptResponse == null || gptResponse.isEmpty()) {
        System.out.println("ChatGptResponse is null. There was an error processing the request.");
        return ("ChatGptResponse is empty. There was an error processing the request. Please try"
            + " again.");
      }

      try {
        JsonNode jsonNode = objectMapper.readTree(gptResponse);
        System.out.println("The response is a valid JSON string." + jsonNode);
      } catch (Exception e) {
        System.out.println("The response is not a valid JSON string.");
      }

      return gptResponse;
    }

    @PostMapping(value = "/situation")
    public String situation(ArkRequest arkRequest) {

      JSONObject json = arkRequest.getBody();

      OpenAiChatEndpoint userChat =
          new OpenAiChatEndpoint(
              EndpointConstants.OPENAI_CHAT_COMPLETION_API,
              OPENAI_AUTH_KEY,
              OPENAI_ORG_ID,
              "gpt-3.5-turbo",
              "user",
              0.7,
              false,
              new ExponentialDelay(3, 5, 2, TimeUnit.SECONDS));

      loader
          .put("situation", new JsonnetArgs(DataType.STRING, json.getString("situation")))
          .put("validAction", new JsonnetArgs(DataType.STRING, json.getString("validAction")))
          .put("callToAction", new JsonnetArgs(DataType.STRING, json.getString("callToAction")))
          .put("actionFormat", new JsonnetArgs(DataType.STRING, json.getString("actionFormat")))
          .loadOrReload();

      String response1 =
          userChat
              .chatCompletion(loader.get("actionPrompt"), "Json-format", arkRequest)
              .blockingFirst()
              .getChoices()
              .get(0)
              .getMessage()
              .getContent();

      System.out.println("ChatGpt Response1: " + response1);

      loader.put("response1", new JsonnetArgs(DataType.STRING, response1)).loadOrReload();

      String response2 =
          userChat
              .chatCompletion(loader.get("validActionCheckPrompt"), "Json-format", arkRequest)
              .blockingFirst()
              .getChoices()
              .get(0)
              .getMessage()
              .getContent();

      System.out.println("ChatGpt Response2: " + response2);

      loader.put("response2", new JsonnetArgs(DataType.STRING, response2)).loadOrReload();

      String response3 =
          userChat
              .chatCompletion(loader.get("ActionFormatPrompt"), "Json-format", arkRequest)
              .blockingFirst()
              .getChoices()
              .get(0)
              .getMessage()
              .getContent();

      System.out.println("ChatGpt Response3: " + response3);

      try {
        JsonNode jsonNode = objectMapper.readTree(response3);
        System.out.println("The response is a valid JSON string." + jsonNode);
        return response3;
      } catch (Exception e) {
        System.out.println("The response is not a valid JSON string so retrying.");
        loader.put("response3", new JsonnetArgs(DataType.STRING, response3)).loadOrReload();

        String response4 =
            userChat
                .chatCompletion(loader.get("getValidFormat"), "Json-format", arkRequest)
                .blockingFirst()
                .getChoices()
                .get(0)
                .getMessage()
                .getContent();

        System.out.println("Final Response: " + response4);
        return response4;
      }
    }

    @PostMapping(value = "/function")
    public Object function(ArkRequest arkRequest) {
      JSONObject json = arkRequest.getBody();

      JsonNode userFormat = null;
      try {
        JSONObject format = json.getJSONObject("format");
        userFormat = objectMapper.readTree(format.toString());
        System.out.println("The user format is a valid JSON string." + format);
      } catch (JsonProcessingException e) {
        e.printStackTrace();
        return "Format has no valid JSON format";
      }

      functionLoader
          .put("prompt", new JsonnetArgs(DataType.STRING, json.getString("prompt")))
          .put("format", new JsonnetArgs(DataType.STRING, userFormat.toString()))
          .loadOrReload();

      FunctionRequest function =
          new FunctionRequest(
              "reply_user", "reply to user's query", new Parameters("object", userFormat));

      Message systemMessage =
          new Message("system", "Only use function_call to reply to use. Do not use content.");
      Message userMessage = new Message("user", functionLoader.get("functionPrompt"));

      List<Message> messages = Arrays.asList(systemMessage, userMessage);

      OpenApiFunctionRequest request =
          new OpenApiFunctionRequest(
              "gpt-3.5-turbo-0613", messages, 0.7, Collections.singletonList(function), "auto");

      FunctionResponse response =
          functionCall().postForObject(OPENAI_CHAT_COMPLETION_API, request, FunctionResponse.class);

      if (response == null
          || response.getChoices().isEmpty()
          || response.getChoices().get(0).getMessage().getFunction_call().getArguments() == null
          || response
              .getChoices()
              .get(0)
              .getMessage()
              .getFunction_call()
              .getArguments()
              .isEmpty()) {
        System.out.println(
            "ChatGptResponse is null or empty. There was an error processing the request.");
        return "ChatGptResponse is empty. There was an error processing the request. Please try"
            + " again.";
      } else {
        try {
          JsonNode jsonNode =
              objectMapper.readTree(
                  response.getChoices().get(0).getMessage().getFunction_call().getArguments());
          System.out.println("The response is a valid JSON string." + jsonNode);
        } catch (Exception e) {
          System.out.println("The response is not a valid JSON string.");
        }
        return response.getChoices().get(0).getMessage().getFunction_call().getArguments();
      }
    }
  }
}
