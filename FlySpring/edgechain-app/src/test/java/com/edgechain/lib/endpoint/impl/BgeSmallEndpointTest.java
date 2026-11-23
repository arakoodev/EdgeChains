package com.edgechain.lib.endpoint.impl;

import com.edgechain.lib.configuration.domain.SecurityUUID;
import com.edgechain.lib.endpoint.impl.embeddings.BgeSmallEndpoint;
import com.edgechain.lib.retrofit.client.RetrofitClientInstance;
import java.io.File;

import org.junit.jupiter.api.Test;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

class BgeSmallEndpointTest {

  @Test
  @DirtiesContext
  void downloadFiles() {
    // Retrofit needs a port
    System.setProperty("server.port", "8888");

    // give Retrofit a mock securityUUI instance so it goes not call context
    SecurityUUID mockSecurityUUID = mock(SecurityUUID.class);
    ReflectionTestUtils.setField(RetrofitClientInstance.class, "securityUUID", mockSecurityUUID);

    try {
      // GIVEN we have no local files
      deleteFiles();

      // WHEN we create the endpoint instance
      // (get tiny JSON files as example download data)
      new BgeSmallEndpoint(
          "https://jsonplaceholder.typicode.com/posts/1",
          "https://jsonplaceholder.typicode.com/posts/2");

      // THEN the files now exist
      File modelFile = new File(BgeSmallEndpoint.MODEL_PATH);
      assertTrue(modelFile.exists());

      File tokenizerFile = new File(BgeSmallEndpoint.TOKENIZER_PATH);
      assertTrue(tokenizerFile.exists());
    } finally {
      // reset the Retrofit instance
      ReflectionTestUtils.setField(RetrofitClientInstance.class, "securityUUID", null);
      ReflectionTestUtils.setField(RetrofitClientInstance.class, "retrofit", null);

      deleteFiles(); // make sure we clean up files afterwards
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
