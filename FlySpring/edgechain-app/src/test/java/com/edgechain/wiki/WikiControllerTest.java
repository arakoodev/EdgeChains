package com.edgechain.wiki;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

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


  @Test
  @DisplayName("Test WikiContent Method Returns WikiResponse")
  @Order(1)
  public void wikiControllerTest_TestWikiContentMethod_ReturnsWikiResponse(TestInfo testInfo) throws InterruptedException {

    logger.info("======== " + testInfo.getDisplayName() + " ========");

    // Prepare test data
    WikiEndpoint wikiEndpoint = new WikiEndpoint();

    TestObserver<WikiResponse> test = wikiEndpoint.getPageContent("Barack Obama").test();

    test.await();

    logger.info(String.valueOf(test.values().get(0)));

    test.assertNoErrors();

  }

}
