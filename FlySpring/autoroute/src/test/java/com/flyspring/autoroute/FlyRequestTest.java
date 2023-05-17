package com.flyspring.autoroute;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
// import org.springframework.mock.web.reactive.function.server.MockServerRequest;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.reactive.function.server.ServerRequest;
import reactor.core.publisher.Mono;
import java.util.List;
import java.util.Map;
import static org.junit.Assert.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

class FlyRequestTest {

  @Test
  void testGetQueryParam() {
    ServerRequest mockedServerRequest = Mockito.mock(ServerRequest.class);
    MultiValueMap<String, String> queryParams = new LinkedMultiValueMap<>();
    queryParams.put("name", List.of("Alice"));
    when(mockedServerRequest.queryParams()).thenReturn(queryParams);
    FlyRequest flyRequest = new FlyRequest(mockedServerRequest);
    String name = flyRequest.getQueryParam("name");
    assertEquals("Alice", name);
  }

  @Test
  void testGetQueryParamArray() {
    ServerRequest mockedServerRequest = Mockito.mock(ServerRequest.class);
    MultiValueMap<String, String> queryParams = new LinkedMultiValueMap<>();
    queryParams.put("fruits", List.of("apple", "orange"));
    when(mockedServerRequest.queryParams()).thenReturn(queryParams);
    FlyRequest flyRequest = new FlyRequest(mockedServerRequest);
    List<String> fruits = flyRequest.getQueryParamArray("fruits");
    assertEquals(List.of("apple", "orange"), fruits);
  }

  @Test
  void testGetQueryParams() {
    ServerRequest mockedServerRequest = Mockito.mock(ServerRequest.class);
    MultiValueMap<String, String> queryParams = new LinkedMultiValueMap<>();
    queryParams.put("name", List.of("Alice"));
    queryParams.put("age", List.of("30"));
    when(mockedServerRequest.queryParams()).thenReturn(queryParams);
    FlyRequest flyRequest = new FlyRequest(mockedServerRequest);
    MultiValueMap<String, String> actualParams = flyRequest.getQueryParams();
    assertEquals(queryParams, actualParams);
  }

  @Test
  void testGetPathVariables() {
    ServerRequest mockedServerRequest = Mockito.mock(ServerRequest.class);
    Map<String, String> pathVariables = Map.of("id", "123");
    when(mockedServerRequest.pathVariables()).thenReturn(pathVariables);
    FlyRequest flyRequest = new FlyRequest(mockedServerRequest);
    Map<String, String> actualVariables = flyRequest.getPathVariables();
    assertEquals(pathVariables, actualVariables);
  }

  @Test
  void testGetPathVariable() {
    ServerRequest mockedServerRequest = Mockito.mock(ServerRequest.class);
    Map<String, String> pathVariables = Map.of("id", "123");
    when(mockedServerRequest.pathVariables()).thenReturn(pathVariables);
    FlyRequest flyRequest = new FlyRequest(mockedServerRequest);
    String id = flyRequest.getPathVariable("id");
    assertEquals("123", id);
  }

  @Test
  void testGetRequestBody() {
    ServerRequest mockedServerRequest = Mockito.mock(ServerRequest.class);
    when(mockedServerRequest.bodyToMono(JsonNode.class))
        .thenReturn(Mono.just(new ObjectMapper().createObjectNode().put("name", "Alice")));
    FlyRequest flyRequest = new FlyRequest(mockedServerRequest);
    JsonNode requestBody = flyRequest.getRequestBody().block();
    assertEquals(new ObjectMapper().createObjectNode().put("name", "Alice"), requestBody);
  }

  @Test
  public void testGetRequestBody_whenRequestIsNotNull_thenReturnsMonoJsonNode() {
    ServerRequest request = Mockito.mock(ServerRequest.class);
    FlyRequest flyRequest = new FlyRequest(request);
    when(request.bodyToMono(JsonNode.class))
        .thenReturn(Mono.just(new ObjectMapper().createObjectNode()));
    JsonNode requestBody = flyRequest.getRequestBody().block();
    assertNotNull(requestBody);
  }
}
