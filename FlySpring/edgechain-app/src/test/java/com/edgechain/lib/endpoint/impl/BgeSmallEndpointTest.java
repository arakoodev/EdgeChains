package com.edgechain.lib.endpoint.impl;

import com.edgechain.testutil.TestConfigSupport;
import java.io.File;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertTrue;

class BgeSmallEndpointTest {

  private final TestConfigSupport testSupport = new TestConfigSupport();

  @BeforeEach
  void setup() {
    testSupport.setupAppContext();
    testSupport.setupRetrofit();
  }

  @AfterEach
  void teardown() {
    testSupport.tearDownRetrofit();
    testSupport.tearDownAppContext();

    deleteFiles(); // make sure we clean up afterwards
  }

  @Test
  void downloadFiles() {
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
  }

  // === HELPER METHODS ===

  private static void deleteFiles() {
    File modelFile = new File(BgeSmallEndpoint.MODEL_PATH);
    modelFile.delete();

    File tokenizerFile = new File(BgeSmallEndpoint.TOKENIZER_PATH);
    tokenizerFile.delete();
  }

}
