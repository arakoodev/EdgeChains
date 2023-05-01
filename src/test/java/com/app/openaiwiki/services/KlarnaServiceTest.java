package com.app.openaiwiki.services;

import com.app.openaiwiki.response.AiPluginResponse;
import com.app.openaiwiki.services.impl.KlarnaServiceImpl;
import com.app.openaiwiki.services.impl.OpenAiClientServiceImpl;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.reactivex.rxjava3.observers.TestObserver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

@ExtendWith(MockitoExtension.class)
@SpringBootTest
public class KlarnaServiceTest {

    @Mock
    RestTemplate restTemplate;
    private MockRestServiceServer mockServer;
    private ObjectMapper objectMapper = new ObjectMapper();


    @Autowired KlarnaService klarnaService = new KlarnaServiceImpl();

    // Arrange
    @BeforeEach
    public void setup(){
        mockServer = MockRestServiceServer.createServer(restTemplate);
    }


    @Test
    @DisplayName("Test Klarna API")
    void testKlarnaAPI_ProvidedQuery_ShouldAssertComplete() throws InterruptedException {

        // Act
        TestObserver<AiPluginResponse> test = klarnaService.request().getObservable().test();

        test.await();

        // Assert
        test.assertComplete();
        System.out.println(test.values());
    }
}
