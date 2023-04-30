package com.app.openaiwiki.services;

import com.app.openaiwiki.response.AiPluginResponse;
import com.app.openaiwiki.services.impl.PluginServiceImpl;
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
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

@ExtendWith(MockitoExtension.class)
@SpringBootTest
public class PluginServiceTest {



    @Mock
    RestTemplate restTemplate;
    private MockRestServiceServer mockServer;
    private ObjectMapper objectMapper = new ObjectMapper();

    @Autowired PluginService pluginService = new PluginServiceImpl();

    // Arrange
    @BeforeEach
    public void setup(){
        mockServer = MockRestServiceServer.createServer(restTemplate);
    }


    @ParameterizedTest
    @DisplayName("Test Klarna Plugin")
    @CsvSource(
            {
                  "Question: What Black tshirts are available at Klarna?"
            })
    void testKlarnaPluginWithOpenAPI_ProvidedQuery_ShouldAssertCompleteAndEmitResult(String query) throws InterruptedException {

        // Act
        TestObserver<String> test = pluginService.requestKlarna(query).getObservable().test();

        test.await();

        // Assert
        test.assertComplete();
        System.out.println(test.values());
    }

}
