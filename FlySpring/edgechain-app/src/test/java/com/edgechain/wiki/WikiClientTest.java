package com.edgechain.wiki;

import com.edgechain.lib.endpoint.impl.WikiEndpoint;
import com.edgechain.lib.wiki.response.WikiResponse;
import io.reactivex.rxjava3.observers.TestObserver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.boot.test.web.server.LocalServerPort;

@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class WikiClientTest {

  @LocalServerPort
  private int port;

  private final Logger logger = LoggerFactory.getLogger(this.getClass());

  @BeforeEach
  public void setup() {
    System.setProperty("server.port", String.valueOf(port));
  }

  @Test
  @DisplayName("Test WikiContent Method Returns WikiResponse")
  @Order(1)
  void wikiControllerTest_TestWikiContentMethod_ReturnsWikiResponse(TestInfo testInfo)
      throws InterruptedException {

    logger.info("======== {} ========", testInfo.getDisplayName());

    // Prepare test data
    WikiEndpoint wikiEndpoint = new WikiEndpoint();
    TestObserver<WikiResponse> test = wikiEndpoint.getPageContent("Barack Obama").test();

    test.await();

    logger.info("{}", test.values().toString());

    test.assertNoErrors();
  }
}
