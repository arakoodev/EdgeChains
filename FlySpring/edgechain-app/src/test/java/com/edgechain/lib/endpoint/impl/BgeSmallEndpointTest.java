package com.edgechain.lib.endpoint.impl;

import java.io.File;
import java.lang.reflect.Field;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationContext;
import com.edgechain.lib.configuration.context.ApplicationContextHolder;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;
import static org.mockito.Mockito.mock;

class BgeSmallEndpointTest {

  @BeforeEach
  void setup() {
    // Retrofit needs an application context which is a
    // private static field so we use reflection to set it.
    ApplicationContext mockAppContext = mock(ApplicationContext.class);
    try {
      Field field = ApplicationContextHolder.class.getDeclaredField("context");
      field.setAccessible(true);
      field.set(null, mockAppContext);
    } catch (NoSuchFieldException | SecurityException | IllegalArgumentException
        | IllegalAccessException e) {
      fail("could not set context for test", e);
    }

    // Retrofit needs a valid port
    System.setProperty("server.port", "8888");
  }

  @AfterEach
  void teardown() {
    // no really, make sure we clean up afterwards
    deleteFiles();
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
