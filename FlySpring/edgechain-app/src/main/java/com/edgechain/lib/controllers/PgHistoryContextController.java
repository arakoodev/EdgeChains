package com.edgechain.lib.controllers;

import com.edgechain.lib.endpoint.impl.PostgreSQLHistoryContextEndpoint;
import com.edgechain.lib.request.ArkRequest;
import com.edgechain.lib.response.ArkResponse;
import com.edgechain.lib.rxjava.retry.impl.FixedDelay;
import org.json.JSONObject;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@RestController("App PgHistoryContextController")
@RequestMapping("/v1/postgresql/historycontext")
public class PgHistoryContextController {

  private PostgreSQLHistoryContextEndpoint endpoint;

  private PostgreSQLHistoryContextEndpoint getInstance() {
    if (Objects.isNull(endpoint))
      return endpoint =
          new PostgreSQLHistoryContextEndpoint(new FixedDelay(2, 5, TimeUnit.SECONDS));
    else return endpoint;
  }

  /*** Creating HistoryContext (Using PostgreSQL) Controller ****/
  @PostMapping
  public ArkResponse createPostgreSQLHistoryContext(
      @RequestParam(value = "id", defaultValue = "initialValue") String id) {
    if (id.equals("initialValue"))
      return new ArkResponse(
          getInstance().create(UUID.randomUUID().toString())); // Here randomId is generated.
    else return new ArkResponse(getInstance().create(id));
  }

  @PutMapping
  public ArkResponse putPostgreSQLHistoryContext(ArkRequest arkRequest) throws IOException {
    JSONObject json = arkRequest.getBody();
    return new ArkResponse(getInstance().put(json.getString("id"), json.getString("response")));
  }

  @GetMapping
  public ArkResponse getPostgreSQLHistoryContext(ArkRequest arkRequest) {
    String id = arkRequest.getQueryParam("id");
    return new ArkResponse(getInstance().get(id));
  }

  @DeleteMapping
  public void deletePostgreSQLHistoryContext(ArkRequest arkRequest) {
    String id = arkRequest.getQueryParam("id");
    getInstance().delete(id);
  }
}
