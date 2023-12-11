package com.edgechain;

import com.edgechain.lib.endpoint.impl.OpenAiEndpoint;
import com.edgechain.lib.openai.client.OpenAiClient;
import com.edgechain.lib.openai.request.ChatCompletionRequest;
import com.edgechain.lib.openai.request.ChatMessage;
import com.edgechain.lib.openai.response.ChatCompletionResponse;
import com.edgechain.lib.rxjava.retry.impl.ExponentialDelay;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

import static com.edgechain.lib.constants.EndpointConstants.OPENAI_CHAT_COMPLETION_API;

@SpringBootApplication
public class SimpleApp {

  private final String OPENAI_AUTH_KEY = ""; // YOUR OPENAI KEY

  public static void main(String[] args) {
    System.setProperty("server.port", "8080");
    SpringApplication.run(SimpleApp.class, args);
  }
  /* Added new methods for it
  @SpringBootApplication
public class SimpleApp {

    private static final Logger logger = LoggerFactory.getLogger(SimpleApp.class);

    @Value("${openai.api.key}")
    private String openaiApiKey;

    public static void main(String[] args) {
        System.setProperty("server.port", "8080");
        SpringApplication.run(SimpleApp.class, args);
    }
  */

  @RestController
  @RequestMapping("/v1/examples")
  public class Conversation {

    private List<ChatMessage> messages;

    public Conversation() {
      messages = new ArrayList<>();
      messages.add(
          new ChatMessage(
              "system",
              "You are a helpful, polite, old English assistant. Answer the user prompt with a bit"
                  + " of humor."));
    }

    @PostMapping("/gpt/ask")
    public ResponseEntity<String> ask(@RequestBody String prompt) {
      try {                     // Added try-catch exception
      updateMessageList("user", prompt);
      String model = "gpt-3.5-turbo";
      ChatCompletionRequest chatCompletionRequest =
          new ChatCompletionRequest(
              model, 0.7, // temperature
              messages, false, null, null, null, null, null, null, null);
      OpenAiClient openAiClient = new OpenAiClient();
      OpenAiEndpoint chatEndpoint =
          new OpenAiEndpoint(
              OPENAI_CHAT_COMPLETION_API,
              OPENAI_AUTH_KEY,
              model,
              "user",
              0.7,
              false,
              new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));
      openAiClient.setEndpoint(chatEndpoint);
      EdgeChain<ChatCompletionResponse> chatCompletion =
          openAiClient.createChatCompletion(chatCompletionRequest);
      String response = chatCompletion.get().getChoices().get(0).getMessage().getContent();
      System.out.println(response);
      updateMessageList("assistant", response);
      return new ResponseEntity<>(response, HttpStatus.OK);
    } catch (Exception e) {                   // Added try-catch exception
                logger.error("An error occurred while processing the request.", e);
                return new ResponseEntity<>("An error occurred: " + e.getMessage(), HttpStatus.INTERNAL_SERVER_ERROR);
            }

    private void updateMessageList(String role, String content) {
      messages.add(new ChatMessage(role, content));

      if (messages.size() > 20) {
        messages.remove(0);
      }
    }
  }
}
