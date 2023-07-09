package com.edgechain.openai;

/* OpenAi ChatCompletion, OpenAi Embeddings, OpenAi Completion **/

import com.edgechain.lib.embeddings.request.OpenAiEmbeddingRequest;
import com.edgechain.lib.embeddings.response.OpenAiEmbeddingResponse;
import com.edgechain.lib.endpoint.impl.OpenAiEndpoint;
import com.edgechain.lib.openai.client.OpenAiClient;
import com.edgechain.lib.openai.request.ChatCompletionRequest;
import com.edgechain.lib.openai.request.ChatMessage;
import com.edgechain.lib.openai.response.ChatCompletionResponse;
import com.edgechain.lib.rxjava.retry.impl.ExponentialDelay;
import com.edgechain.lib.rxjava.retry.impl.FixedDelay;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.reactivex.rxjava3.observers.TestObserver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.concurrent.TimeUnit;

import static com.edgechain.lib.constants.EndpointConstants.*;

@ExtendWith(MockitoExtension.class)
@SpringBootTest
public class OpenAiClientTest {

  private Logger logger = LoggerFactory.getLogger(this.getClass());

  @Mock RestTemplate restTemplate;
  private MockRestServiceServer mockServer;
  private ObjectMapper objectMapper = new ObjectMapper();

  @BeforeEach
  public void setup() {
    mockServer = MockRestServiceServer.createServer(restTemplate);
  }

  // Test 1: OpenAI ChatCompletion
  @Test
  @DisplayName("Test OpenAi ChatCompletion")
  public void testOpenAiClient_ChatCompletion() throws InterruptedException {

    // Step 1 : Create OpenAi Endpoint
    OpenAiEndpoint endpoint =
        new OpenAiEndpoint(
            OPENAI_CHAT_COMPLETION_API,
            "",
            "gpt-3.5-turbo",
            "user",
            0.7,
            new FixedDelay(3, 3, TimeUnit.SECONDS));
    // E.g Prompt: Write 10 unique sentences on Java Language

    // Step 2: ChatCompletionRequest
    String prompt = "Write 10 unique sentences on Java Language";
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

  @Test
  @DisplayName("Test OpenAi Embeddings")
  public void testOpenAiClient_Embeddings() throws InterruptedException {

    // Step 1: Create OpenAiEndpoint
    OpenAiEndpoint endpoint =
        new OpenAiEndpoint(
            OPENAI_EMBEDDINGS_API,
            "",
            "text-embedding-ada-002",
            new ExponentialDelay(3, 5, 2, TimeUnit.SECONDS));

    /**
     * Request OpenAi Embeddings; it's giving me an error 1st ==> 3 second 2nd ===> 3 x 2 = 6
     * seconds 3rd ===> 6 x 2 = 12 Seconds
     */
    String input = "Hey, we are building LLM using Spring and Java";
    OpenAiEmbeddingRequest embeddingRequest =
        new OpenAiEmbeddingRequest(endpoint.getModel(), input);
    TestObserver<OpenAiEmbeddingResponse> test =
        new OpenAiClient(endpoint)
            .createEmbeddings(embeddingRequest)
            .getScheduledObservable()
            .test();

    // Step 4: To act & assert
    test.await();

    logger.info(test.values().toString());

    // Assert
    test.assertNoErrors();
  }

  @Test
  public void testOpenAiClient_Completion() {}
}
