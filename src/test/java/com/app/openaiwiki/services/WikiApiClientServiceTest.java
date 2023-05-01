package com.app.openaiwiki.services;

import com.app.openaiwiki.services.impl.WikiClientServiceImpl;
import io.reactivex.rxjava3.observers.TestObserver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;


@ExtendWith(MockitoExtension.class)
@SpringBootTest
public class WikiApiClientServiceTest {

    private Logger logger = LoggerFactory.getLogger(this.getClass());

    @Mock RestTemplate restTemplate;
    private MockRestServiceServer mockServer;

    @Autowired WikiClientService wikiClientService = new WikiClientServiceImpl();

    @BeforeEach
    public void setup(){
        mockServer = MockRestServiceServer.createServer(restTemplate);
    }


    @DisplayName("Test Wiki API")
    @ParameterizedTest
    @CsvSource({"David Chanoff"})
    void testWikiApi_ProvidedPageTitle_ShouldReturnHttpStatus200(String pageTitle) throws InterruptedException {

        // Act
        TestObserver<String> test = wikiClientService.getPageContent(pageTitle).getObservable().test();

        // Assert
        test.assertComplete();
    }

}
