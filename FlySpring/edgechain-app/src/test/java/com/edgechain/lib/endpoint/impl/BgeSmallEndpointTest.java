package com.edgechain.lib.endpoint.impl;

import com.edgechain.testutil.TestConfigSupport;
import java.io.File;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.test.annotation.DirtiesContext;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Disabled("works locally but breaks Github builds")
class BgeSmallEndpointTest {

  private final TestConfigSupport testSupport = new TestConfigSupport();

  @Test
  @DirtiesContext
  void downloadFiles() {
    testSupport.setupAppContext();
    testSupport.setupRetrofit();
    try {
      // GIVEN we have no local files
      deleteFiles();

      // WHEN we create the endpoint instance
      // (get tiny JSON files as example download data)
      new BgeSmallEndpoint("https://jsonplaceholder.typicode.com/posts/1",
          "https://jsonplaceholder.typicode.com/posts/2");

      // THEN the files now exist
      File modelFile = new File(BgeSmallEndpoint.MODEL_PATH);
      assertTrue(modelFile.exists());

      File tokenizerFile = new File(BgeSmallEndpoint.TOKENIZER_PATH);
      assertTrue(tokenizerFile.exists());
    } finally {
      deleteFiles(); // make sure we clean up afterwards

      testSupport.tearDownAppContext();
      testSupport.tearDownRetrofit();
    }
  }

  // === HELPER METHODS ===

  private static void deleteFiles() {
    File modelFile = new File(BgeSmallEndpoint.MODEL_PATH);
    modelFile.delete();

    File tokenizerFile = new File(BgeSmallEndpoint.TOKENIZER_PATH);
    tokenizerFile.delete();
  }

}
