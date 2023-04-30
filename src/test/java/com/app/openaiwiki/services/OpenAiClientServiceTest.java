package com.app.openaiwiki.services;


import com.app.openaiwiki.services.impl.OpenAiClientServiceImpl;
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
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

@ExtendWith(MockitoExtension.class)
@SpringBootTest
public class OpenAiClientServiceTest {

    private Logger logger = LoggerFactory.getLogger(this.getClass());

    @Mock RestTemplate restTemplate;
    private MockRestServiceServer mockServer;
    private ObjectMapper objectMapper = new ObjectMapper();

    @Autowired OpenAiClientService openAiClientService = new OpenAiClientServiceImpl();

    // Arrange
    @BeforeEach
    public void setup(){
        mockServer = MockRestServiceServer.createServer(restTemplate);
    }

    // You can also test by changing AuthKey to random value; it will use ExponentialRetryStrategy...
    @Test
    @DisplayName("Test OpenAi API")
    void testOpenAiClient_ProvidedEmptyString_ShouldReturnHttpStatus200AndRetryIfErrorEmits() {

        // Act
        TestObserver<String> test =
                openAiClientService.createChatCompletionV1("",
                        "Question: Author David Chanoff has collaborated with a U.S. Navy admiral who served as the ambassador to the United Kingdom under which President?")
                        .getObservable().test();

        // Assert
        test.assertComplete();
    }
}
