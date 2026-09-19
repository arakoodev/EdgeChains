package com.edgechain.wiki;

import com.edgechain.lib.configuration.domain.SecurityUUID;
import com.edgechain.lib.endpoint.impl.wiki.WikiEndpoint;
import com.edgechain.lib.retrofit.client.RetrofitClientInstance;
import com.edgechain.lib.wiki.response.WikiResponse;
import io.reactivex.rxjava3.observers.TestObserver;
import java.io.IOException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.util.ReflectionTestUtils;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class WikiClientTest {

  @LocalServerPort private int port;

  private final Logger logger = LoggerFactory.getLogger(this.getClass());

  @BeforeEach
  public void setup() {
    System.setProperty("server.port", String.valueOf(port));
  }

  @Test
  @DisplayName("Test WikiContent Method Handles Exception")
  @DirtiesContext
  void wikiControllerTest_TestWikiContentMethod_HandlesException(TestInfo testInfo)
      throws InterruptedException {
    try {
      // create a mock instance that will generate a non-IOException in the interceptor
      SecurityUUID mockSecurityUUID = mock(SecurityUUID.class);
      when(mockSecurityUUID.getAuthKey()).thenThrow(new RuntimeException("FORCED TEST EXCEPTION"));
      ReflectionTestUtils.setField(RetrofitClientInstance.class, "securityUUID", mockSecurityUUID);
      ReflectionTestUtils.setField(RetrofitClientInstance.class, "retrofit", null);

      logger.info("======== {} ========", testInfo.getDisplayName());

      // Prepare test data
      WikiEndpoint wikiEndpoint = new WikiEndpoint();
      TestObserver<WikiResponse> test = wikiEndpoint.getPageContent("Barack Obama").test();

      test.await();

      logger.info("{}", test.values().toString());

      test.assertError(IOException.class);
    } finally {
      // reset instance
      ReflectionTestUtils.setField(RetrofitClientInstance.class, "securityUUID", null);
      ReflectionTestUtils.setField(RetrofitClientInstance.class, "retrofit", null);
    }
  }
}
