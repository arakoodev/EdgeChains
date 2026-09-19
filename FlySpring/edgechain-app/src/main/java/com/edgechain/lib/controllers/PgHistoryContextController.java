package com.edgechain.lib.controllers;

import com.edgechain.lib.context.domain.HistoryContext;
import com.edgechain.lib.endpoint.impl.context.PostgreSQLHistoryContextEndpoint;
import com.edgechain.lib.request.ArkRequest;
import com.edgechain.lib.rxjava.retry.impl.FixedDelay;
import org.json.JSONObject;
import org.springframework.web.bind.annotation.*;

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
  public HistoryContext create(
      @RequestParam(value = "id", defaultValue = "initialValue") String id) {
    if (id.equals("initialValue"))
      return getInstance().create(UUID.randomUUID().toString()); // Here randomId is generated.
    else return getInstance().create(id);
  }

  @PutMapping
  public HistoryContext update(ArkRequest arkRequest) {
    JSONObject json = arkRequest.getBody();
    return getInstance().put(json.getString("id"), json.getString("response"));
  }

  @GetMapping
  public HistoryContext getPostgreSQLHistoryContext(ArkRequest arkRequest) {
    String id = arkRequest.getQueryParam("id");
    return getInstance().get(id);
  }

  @DeleteMapping
  public void delete(ArkRequest arkRequest) {
    String id = arkRequest.getQueryParam("id");
    getInstance().delete(id);
  }
}
