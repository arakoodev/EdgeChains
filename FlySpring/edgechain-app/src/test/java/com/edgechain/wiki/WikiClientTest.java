package com.edgechain.wiki;

import com.edgechain.lib.endpoint.impl.WikiEndpoint;
import io.reactivex.rxjava3.observers.TestObserver;
import org.junit.jupiter.api.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.test.context.SpringBootTest;
import static org.junit.jupiter.api.Assertions.*;

import com.edgechain.lib.wiki.response.WikiResponse;
import org.springframework.boot.test.web.server.LocalServerPort;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class WikiClientTest {

  @LocalServerPort private int port;

  private final Logger logger = LoggerFactory.getLogger(this.getClass());

  @BeforeEach
  public void setup() {
    System.setProperty("server.port", "" + port);
  }

  @Test
  @DisplayName("Test WikiContent Method Returns WikiResponse")
  @Order(1)
  public void wikiControllerTest_TestWikiContentMethod_ReturnsWikiResponse(TestInfo testInfo) {

    assertDoesNotThrow(
        () -> {
          logger.info("======== " + testInfo.getDisplayName() + " ========");

          // Prepare test data
          WikiEndpoint wikiEndpoint = new WikiEndpoint();
          TestObserver<WikiResponse> test = wikiEndpoint.getPageContent("Barack Obama").test();

          test.await();

          logger.info(test.values().toString());
        });
  }
}
