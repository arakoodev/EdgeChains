package com.edgechain.openai;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.impl.OpenAiEndpoint;
import com.edgechain.lib.openai.client.OpenAiClient;
import com.edgechain.lib.openai.request.ChatCompletionRequest;
import com.edgechain.lib.openai.request.ChatMessage;
import com.edgechain.lib.openai.request.CompletionRequest;
import com.edgechain.lib.openai.response.ChatCompletionResponse;
import com.edgechain.lib.openai.response.CompletionResponse;
import com.edgechain.lib.rxjava.retry.impl.ExponentialDelay;
import com.edgechain.lib.rxjava.retry.impl.FixedDelay;
import io.reactivex.rxjava3.observers.TestObserver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;
import java.util.concurrent.TimeUnit;

import static com.edgechain.lib.constants.EndpointConstants.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.DEFINED_PORT)
public class OpenAiClientTest {

  private Logger logger = LoggerFactory.getLogger(this.getClass());

  @BeforeEach
  public void setup() {
    System.setProperty("server.port", "8080");
  }

  @ParameterizedTest
  @CsvSource({
    "Write 10 unique sentences on Java Language",
    "Can you explain Ant Bee Colony Optimization Algorithm?"
  })
  @DisplayName("Test OpenAI ChatCompletion")
  public void testOpenAiEndpoint_ChatCompletionShouldAssertNoErrors(String prompt)
      throws InterruptedException {

    // Step 1 : Create OpenAi Endpoint
    OpenAiEndpoint endpoint =
        new OpenAiEndpoint(
            OPENAI_CHAT_COMPLETION_API,
            "", // apiKey
            "", // orgId
            "gpt-3.5-turbo",
            "user",
            0.7,
            false,
            new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

    TestObserver<ChatCompletionResponse> test = endpoint.getChatCompletion(prompt).test();

    // Step 4: To act & assert
    test.await();

    logger.info(test.values().toString());

    // Assert
    test.assertNoErrors();
  }

  @ParameterizedTest
  @CsvSource({
    "Write 10 unique sentences on Java Language",
    "Can you explain Ant Bee Colony Optimization Algorithm?"
  })
  @DisplayName("Test OpenAI ChatCompletion Stream")
  public void testOpenAiEndpoint_ChatCompletionStreamResponseShouldAssertNoErrors(String prompt)
      throws InterruptedException {

    // Step 1 : Create OpenAi Endpoint
    OpenAiEndpoint endpoint =
        new OpenAiEndpoint(
            OPENAI_CHAT_COMPLETION_API,
            "", // apiKey
            "", // orgId
            "gpt-3.5-turbo",
            "user",
            0.7,
            true,
            new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

    TestObserver<ChatCompletionResponse> test = endpoint.getChatCompletion(prompt).test();

    // Step 4: To act & assert
    test.await();

    logger.info(test.values().toString());

    // Assert
    test.assertNoErrors();
  }

  @Test
  @DisplayName("Test OpenAI Embeddings")
  public void testOpenAiEndpoint_EmbeddingsShouldAssertNoErrors() throws InterruptedException {

    String input = "Hey, we are building LLMs using Spring and Java";

    // Step 1 : Create OpenAi Endpoint
    OpenAiEndpoint endpoint =
        new OpenAiEndpoint(
            OPENAI_EMBEDDINGS_API,
            "", // apiKey
            "", // orgId
            "text-embedding-ada-002", // model
            null,
            null,
            null,
            new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

    TestObserver<WordEmbeddings> test = endpoint.getEmbeddings(input).test();

    // Step 4: To act & assert
    test.await();

    logger.info(test.values().toString());

    // Assert
    test.assertNoErrors();
  }

  @Test
  @DisplayName("OpenAiClient Create_Completion Test1")
  public void test_OpenAiClient_Completion() throws InterruptedException {

    // Step 1: Create OpenAi endpoint
    OpenAiEndpoint endpoint = new OpenAiEndpoint(OPENAI_COMPLETION_API, "", "text-davinci-003");

    String prompt = "Write an unique jokes";

    // Step 2: Create a CompletionRequest for createCompletion method
    CompletionRequest completionRequest =
        CompletionRequest.builder().model(endpoint.getModel()).prompt(prompt).build();

    // Step 3: OpenAiClient
    TestObserver<CompletionResponse> test =
        new OpenAiClient(endpoint)
            .createCompletion(completionRequest)
            .getScheduledObservable()
            .test();

    // Step 4: To act & assert
    test.await();

    logger.info(test.values().toString());

    // Assert
    test.assertNoErrors();
  }

  @Test
  @DisplayName("OpenAiClient Create_Completion Test2")
  public void test2_OpenAiClient_Completion() throws InterruptedException {

    // Step 1: Create OpenAi endpoint
    OpenAiEndpoint endpoint =
        new OpenAiEndpoint(
            OPENAI_COMPLETION_API, "", "text-davinci-003", new FixedDelay(3, 3, TimeUnit.SECONDS));

    String prompt =
        "The function g is defined by g(x)=(x-3)^2. If g(a)=a^2, what is the value of a?";

    // Step 2: Create a CompletionRequest for createCompletion method
    CompletionRequest completionRequest =
        CompletionRequest.builder().model(endpoint.getModel()).prompt(prompt).build();

    // Step 3: OpenAiClient
    TestObserver<CompletionResponse> test =
        new OpenAiClient(endpoint)
            .createCompletion(completionRequest)
            .getScheduledObservable()
            .test();

    // Step 4: To act & assert
    test.await();

    logger.info(test.values().toString());

    // Assert
    test.assertNoErrors();
  }

  @Test
  @DisplayName("OpenAi ChatCompletion Test2")
  public void test2_OpenAiClient_ChatCompletion() throws InterruptedException {

    // Step 1 : Create OpenAi Endpoint
    OpenAiEndpoint endpoint =
        new OpenAiEndpoint(
            OPENAI_CHAT_COMPLETION_API,
            "",
            "gpt-3.5-turbo",
            "user",
            0.7,
            new ExponentialDelay(3, 4, 2, TimeUnit.SECONDS));
    // E.g Prompt: Write 10 unique sentences on Java Language

    // Step 2: ChatCompletionRequest
    String prompt = "Write 10 unique sentences about the Spring Native";
    ChatCompletionRequest chatCompletionRequest =
        ChatCompletionRequest.builder()
            .model(endpoint.getModel())
            .temperature(endpoint.getTemperature())
            .messages(List.of(new ChatMessage(endpoint.getRole(), prompt)))
            .stream(false)
            .build();

    // Step 3: OpenAiClient
    TestObserver<ChatCompletionResponse> test =
        new OpenAiClient(endpoint)
            .createChatCompletion(chatCompletionRequest)
            .getScheduledObservable()
            .test();

    // Step 4: To act & assert
    test.await();

    logger.info(test.values().toString());

    // Assert
    test.assertNoErrors();
  }
}
