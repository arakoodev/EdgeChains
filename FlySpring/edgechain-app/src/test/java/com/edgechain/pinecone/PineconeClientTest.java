package com.edgechain.pinecone;

import com.edgechain.lib.endpoint.impl.PineconeEndpoint;
import com.edgechain.lib.index.client.impl.PineconeClient;
import com.edgechain.lib.response.StringResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.DEFINED_PORT)
public class PineconeClientTest {

  @LocalServerPort private int port;

  @Autowired private PineconeClient pineconeClient;

  private PineconeEndpoint pineconeEndpoint;

  @BeforeEach
  void setUp() {
    System.setProperty("server.port", String.valueOf(port));
    pineconeEndpoint = new PineconeEndpoint("https://arakoo.ai", "apiKey", "Pinecone");
  }

  @Test
  @DisplayName("Test Upsert")
  public void test_Upsert() {
    RestTemplate restTemplate = mock(RestTemplate.class);
    ResponseEntity<String> responseEntity = ResponseEntity.ok("some dummy data");
    when(restTemplate.exchange(anyString(), any(), any(), eq(String.class)))
        .thenReturn(responseEntity);

    EdgeChain<StringResponse> result = pineconeClient.upsert(pineconeEndpoint);

    assertNotNull(result);
  }

  @Test
  @DisplayName("Test Batch Upsert")
  public void test_Batch_Upsert() {
    RestTemplate restTemplate = mock(RestTemplate.class);
    ResponseEntity<String> responseEntity = ResponseEntity.ok("some dummy data");
    when(restTemplate.exchange(anyString(), any(), any(), eq(String.class)))
        .thenReturn(responseEntity);

    EdgeChain<StringResponse> result = pineconeClient.batchUpsert(pineconeEndpoint);

    assertNotNull(result);
  }

  @Test
  @DisplayName("Test Query")
  public void test_Query() {
    RestTemplate restTemplate = mock(RestTemplate.class);
    ResponseEntity<String> responseEntity = ResponseEntity.ok("some dummy data");
    when(restTemplate.exchange(anyString(), any(), any(), eq(String.class)))
        .thenReturn(responseEntity);

    EdgeChain<StringResponse> queryResult = pineconeClient.batchUpsert(pineconeEndpoint);

    assertNotNull(queryResult);
    assertNull(queryResult.get().getResponse());
  }

  @Test
  @DisplayName("Test Delete All")
  public void test_Delete_All() {
    RestTemplate restTemplate = mock(RestTemplate.class);
    ResponseEntity<String> responseEntity = ResponseEntity.ok("some dummy data");
    when(restTemplate.exchange(anyString(), any(), any(), eq(String.class)))
        .thenReturn(responseEntity);

    EdgeChain<StringResponse> deleteResult = pineconeClient.deleteAll(pineconeEndpoint);

    assertNotNull(deleteResult);
    assertTrue(deleteResult.get().getResponse().endsWith("Pinecone"));
  }

  @Test
  @DisplayName("Test Get Namespace")
  public void test_GetNamespace() {
    // Test for non-empty namespace
    String nonEmptyNamespace = pineconeClient.getNamespace(pineconeEndpoint);
    assertEquals("Pinecone", nonEmptyNamespace);

    // Test for empty namespace
    pineconeEndpoint.setNamespace("");
    String emptyNamespace = pineconeClient.getNamespace(pineconeEndpoint);
    assertEquals("", emptyNamespace);

    // Test for null namespace
    pineconeEndpoint.setNamespace(null);
    String nullNamespace = pineconeClient.getNamespace(pineconeEndpoint);
    assertEquals("", nullNamespace);
  }
}
