package com.edgechain.wiki;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

import com.edgechain.lib.endpoint.impl.WikiEndpoint;
import com.edgechain.lib.wiki.response.WikiResponse;
import com.edgechain.service.controllers.wiki.WikiController;

import io.reactivex.rxjava3.core.Single;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class WikiControllerTest {

  @LocalServerPort int randomServerPort;

  private final Logger logger = LoggerFactory.getLogger(this.getClass());

  @BeforeEach
  public void setup() {
    System.setProperty("server.port", "" + randomServerPort);
  }

  @Autowired private WikiController wikiController;

  @Test
  @DisplayName("Test WikiContent Method Returns WikiResponse")
  @Order(1)
  public void wikiControllerTest_TestWikiContentMethod_ReturnsWikiResponse(TestInfo testInfo) {

    logger.info("======== " + testInfo.getDisplayName() + " ========");

    // Prepare test data
    WikiEndpoint wikiEndpoint = new WikiEndpoint();
    wikiEndpoint.setInput("what is the Redis?");

    // Call the wikiContent method
    Single<WikiResponse> result = wikiController.wikiContent(wikiEndpoint);

    // Verify the response
    assertNotNull(result);
    assertEquals(WikiResponse.class, result.blockingGet().getClass());
  }

  @Test
  @DisplayName("Test WikiContent Method Populates Response Text")
  @Order(2)
  public void wikiControllerTest_TestWikiContentMethodPopulates_ReturnResponseText(
      TestInfo testInfo) {

    logger.info("======== " + testInfo.getDisplayName() + " ========");

    // Prepare test data
    WikiEndpoint wikiEndpoint = new WikiEndpoint();
    wikiEndpoint.setInput("what is the Redis?");

    // Call the wikiContent method
    Single<WikiResponse> result = wikiController.wikiContent(wikiEndpoint);

    // Verify that the response text is populated
    assertNotNull(result);
    WikiResponse response = result.blockingGet();
    assertNotNull(response);
    assertNotNull(response.getText());
  }
}
