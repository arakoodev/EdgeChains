package com.edgechain.openai;

import com.edgechain.lib.embeddings.request.OpenAiEmbeddingRequest;
import com.edgechain.lib.embeddings.response.OpenAiEmbeddingResponse;
import com.edgechain.lib.endpoint.Endpoint;
import com.edgechain.lib.endpoint.impl.OpenAiEndpoint;
import com.edgechain.lib.openai.client.OpenAiClient;
import com.edgechain.lib.openai.request.ChatCompletionRequest;
import com.edgechain.lib.openai.request.ChatMessage;
import com.edgechain.lib.openai.response.ChatCompletionResponse;
import com.edgechain.lib.retrofit.client.RetrofitClientInstance;
import com.edgechain.lib.rxjava.retry.impl.FixedDelay;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.reactivex.rxjava3.observers.TestObserver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;
import retrofit2.Retrofit;

import java.util.List;
import java.util.concurrent.TimeUnit;

import static com.edgechain.lib.constants.EndpointConstants.OPENAI_CHAT_COMPLETION_API;
import static com.edgechain.lib.constants.EndpointConstants.OPENAI_EMBEDDINGS_API;

@ExtendWith(MockitoExtension.class)
@SpringBootTest
public class OpenAiClientTest {

    private Logger logger = LoggerFactory.getLogger(this.getClass());

    @Mock
    RestTemplate restTemplate;
    private MockRestServiceServer mockServer;
    private ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    public void setup(){
        mockServer = MockRestServiceServer.createServer(restTemplate);
    }

    @ParameterizedTest
    @CsvSource(
            {", Can you 10 sentences on Java Language?"}
    )
    @DisplayName("Test OpenAI ChatCompletion")
    void testOpenAiClient_ChatCompletion(String apiKey, String input) throws InterruptedException {

    OpenAiEndpoint endpoint =
        new OpenAiEndpoint(
            OPENAI_CHAT_COMPLETION_API,
                apiKey,
                "gpt-3.5-turbo",
                "user",
                0.7,
                new FixedDelay(3, 3, TimeUnit.SECONDS));

    ChatCompletionRequest chatCompletionRequest =
                ChatCompletionRequest.builder()
                        .model(endpoint.getModel())
                        .temperature(endpoint.getTemperature())
                        .messages(List.of(new ChatMessage(endpoint.getRole(), input)))
                        .stream(endpoint.getStream())
                        .build();

        TestObserver<ChatCompletionResponse> test = new OpenAiClient(endpoint).createChatCompletion(chatCompletionRequest)
                .getScheduledObservable().test();

        test.await();

        logger.info(test.values().toString());

        // Assert
        test.assertNoErrors();

    }

}
