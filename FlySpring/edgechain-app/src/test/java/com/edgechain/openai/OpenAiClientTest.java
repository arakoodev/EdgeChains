package com.edgechain.openai;

import com.edgechain.lib.endpoint.impl.llm.OpenAiChatEndpoint;
import com.edgechain.lib.openai.request.ChatCompletionRequest;
import com.edgechain.lib.openai.request.ChatMessage;
import com.edgechain.lib.openai.response.ChatCompletionResponse;
import com.edgechain.lib.rxjava.retry.impl.ExponentialDelay;
import com.edgechain.lib.utils.JsonUtils;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.reactivex.rxjava3.observers.TestObserver;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.List;
import java.util.concurrent.TimeUnit;

import static com.edgechain.lib.constants.EndpointConstants.OPENAI_CHAT_COMPLETION_API;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class OpenAiClientTest {

  @LocalServerPort private int port;

  private final Logger logger = LoggerFactory.getLogger(this.getClass());

  @BeforeEach
  public void setup() {
    System.setProperty("server.port", "" + port);
  }

  @ParameterizedTest
  @ValueSource(classes = {ChatCompletionRequest.class})
  @DisplayName("Test ChatCompletionRequest Json Request")
  @Order(1)
  public void testOpenAiClient_ChatCompletionRequest_ShouldMatchRequestBody(Class<?> clazz)
      throws IOException {

    ObjectMapper mapper = new ObjectMapper();
    mapper.setSerializationInclusion(JsonInclude.Include.NON_NULL);

    ChatCompletionRequest chatCompletionRequest =
        ChatCompletionRequest.builder()
            .model("gpt-3.5-turbo")
            .temperature(0.7)
            .messages(
                List.of(
                    new ChatMessage(
                        "user", "Can you write two unique sentences on Java Language?")))
            .stream(false)
            .build();

    byte[] bytes =
        Files.readAllBytes(Paths.get("src/test/java/resources/" + clazz.getSimpleName() + ".json"));
    String originalJson = new String(bytes);

    assertEquals(
        mapper.readTree(JsonUtils.convertToString(chatCompletionRequest)),
        mapper.readTree(originalJson));
  }

  @ParameterizedTest
  @ValueSource(classes = {ChatCompletionResponse.class})
  @DisplayName("Test ChatCompletionResponse POJO")
  @Order(2)
  public void testOpenAiClient_ChatCompletionResponse_ShouldMappedToPOJO(Class<?> clazz) {
    assertDoesNotThrow(
        () -> {
          byte[] bytes =
              Files.readAllBytes(
                  Paths.get("src/test/java/resources/" + clazz.getSimpleName() + ".json"));
          String json = new String(bytes);

          ChatCompletionResponse chatCompletionResponse =
              JsonUtils.convertToObject(json, ChatCompletionResponse.class);
          logger.info("" + chatCompletionResponse); // Printing the object
        });
  }

  @Test
  @DisplayName("Test OpenAiChatEndpoint With Retry Mechanism")
  @Order(3)
  public void testOpenAiClient_WithRetryMechanism_ShouldThrowExceptionWithRetry(TestInfo testInfo)
      throws InterruptedException {

    System.out.println("======== " + testInfo.getDisplayName() + " ========");

    OpenAiChatEndpoint endpoint =
        new OpenAiChatEndpoint(
            OPENAI_CHAT_COMPLETION_API,
            "", // apiKey
            "", // orgId
            "gpt-3.5-turbo",
            "user",
            0.7,
            false,
            new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

    TestObserver<ChatCompletionResponse> test =
        endpoint
            .chatCompletion(
                "Can you write two unique sentences on Java Language?", "TestChain", null)
            .test();

    // Step 4: To act & assert
    test.await();

    // Assert
    test.assertError(Exception.class);
  }

  @Test
  @DisplayName("Test OpenAiChatEndpoint With No Retry Mechanism")
  @Order(4)
  public void testOpenAiClient_WithNoRetryMechanism_ShouldThrowExceptionWithNoRetry(
      TestInfo testInfo) throws InterruptedException {

    System.out.println("======== " + testInfo.getDisplayName() + " ========");

    // Step 1 : Create OpenAi Endpoint
    OpenAiChatEndpoint endpoint =
        new OpenAiChatEndpoint(
            OPENAI_CHAT_COMPLETION_API,
            "", // apiKey
            "", // orgId
            "gpt-3.5-turbo",
            "user",
            0.7,
            false);

    TestObserver<ChatCompletionResponse> test =
        endpoint
            .chatCompletion(
                "Can you write two unique sentences on Java Language?", "TestChain", null)
            .test();

    // Step 4: To act & assert
    test.await();

    // Assert
    test.assertError(Exception.class);
  }
}
